import express from 'express';
import multer from 'multer';
import { requireAnonymousId, validateReport } from '../utils/validation.js';
import { logError, logSuccess } from '../utils/logger.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import supabase, { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/reports
 * List all reports with optional filters
 * Optional: includes is_favorite and is_flagged if X-Anonymous-Id header is present
 */
router.get('/', async (req, res) => {
  try {
    const anonymousId = req.headers['x-anonymous-id'];
    
    const { data: reports, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        error: 'Database query error',
        message: error.message
      });
    }

    // If anonymous_id is provided, enrich reports with favorite and flag status
    if (anonymousId && reports && reports.length > 0) {
      const reportIds = reports.map(r => r.id);
      
      // Get favorites
      const { data: favorites } = await supabase
        .from('favorites')
        .select('report_id')
        .eq('anonymous_id', anonymousId)
        .in('report_id', reportIds);
      
      // Get flags
      const { data: flags } = await supabase
        .from('report_flags')
        .select('report_id')
        .eq('anonymous_id', anonymousId)
        .in('report_id', reportIds);
      
      const favoriteIds = new Set(favorites?.map(f => f.report_id) || []);
      const flaggedIds = new Set(flags?.map(f => f.report_id) || []);
      
      // Enrich reports
      const enrichedReports = reports.map(report => ({
        ...report,
        is_favorite: favoriteIds.has(report.id),
        is_flagged: flaggedIds.has(report.id)
      }));
      
      return res.json({
        success: true,
        data: enrichedReports
      });
    }

    res.json({
      success: true,
      data: reports
    });
  } catch (err) {
    res.status(500).json({
      error: 'Unexpected server error',
      message: err.message
    });
  }
});

/**
 * GET /api/reports/:id
 * Get a single report by ID
 * Optional: includes is_favorite and is_flagged if X-Anonymous-Id header is present
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.headers['x-anonymous-id'];
    
    const { data: report, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Report not found'
        });
      }
      return res.status(500).json({
        error: 'Failed to fetch report',
        message: error.message
      });
    }

    // If anonymous_id is provided, check favorite and flag status
    if (anonymousId) {
      const [favoriteResult, flagResult] = await Promise.all([
        supabase
          .from('favorites')
          .select('id')
          .eq('anonymous_id', anonymousId)
          .eq('report_id', id)
          .maybeSingle(),
        supabase
          .from('report_flags')
          .select('id')
          .eq('anonymous_id', anonymousId)
          .eq('report_id', id)
          .maybeSingle()
      ]);
      
      const enrichedReport = {
        ...report,
        is_favorite: !!favoriteResult.data,
        is_flagged: !!flagResult.data
      };
      
      return res.json({
        success: true,
        data: enrichedReport
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (err) {
    res.status(500).json({
      error: 'Unexpected server error',
      message: err.message
    });
  }
});

/**
 * POST /api/reports
 * Create a new report
 * Requires: X-Anonymous-Id header
 */
router.post('/', requireAnonymousId, async (req, res) => {
  try {
    const anonymousId = req.anonymousId;
    
    logSuccess('Creating report', { anonymousId, title: req.body.title });
    
    // Validate request body
    validateReport(req.body);
    
    // Ensure anonymous user exists in anonymous_users table (idempotent)
    try {
      await ensureAnonymousUser(anonymousId);
    } catch (error) {
      logError(error, req);
      return res.status(500).json({
        error: 'Failed to ensure anonymous user',
        message: error.message
      });
    }
    
    // Check for duplicate report (same anonymous_id, category, zone, title within last 10 minutes)
    const title = req.body.title.trim();
    const category = req.body.category;
    const zone = req.body.zone;
    
    // Calculate timestamp 10 minutes ago
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: duplicateCheck, error: checkError } = await supabase
      .from('reports')
      .select('id')
      .eq('anonymous_id', anonymousId)
      .eq('category', category)
      .eq('zone', zone)
      .eq('title', title)
      .gte('created_at', tenMinutesAgo)
      .maybeSingle();
    
    if (checkError) {
      return res.status(500).json({
        error: 'Failed to check for duplicates',
        message: checkError.message
      });
    }
    
    if (duplicateCheck) {
      return res.status(409).json({
        error: 'DUPLICATE_REPORT',
        message: 'Ya existe un reporte similar reciente'
      });
    }
    
    // Insert report using Supabase client (100% Supabase, NO SQL manual)
    // Parse and validate incident_date if provided
    let incidentDate = null;
    if (req.body.incident_date) {
      const parsedDate = new Date(req.body.incident_date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'incident_date must be a valid ISO 8601 date string'
        });
      }
      incidentDate = parsedDate.toISOString();
    }
    
    const { data, error } = await supabase
      .from('reports')
      .insert({
        anonymous_id: anonymousId,
        title: req.body.title.trim(),
        description: req.body.description.trim(),
        category: req.body.category,
        zone: req.body.zone,
        address: req.body.address.trim(),
        latitude: req.body.latitude || null,
        longitude: req.body.longitude || null,
        status: req.body.status || 'pendiente',
        incident_date: incidentDate || new Date().toISOString() // Default to current date if not provided
      })
      .select()
      .single();
    
    if (error) {
      logError(error, req);
      return res.status(500).json({
        error: 'Failed to create report',
        message: error.message
      });
    }
    
    logSuccess('Report created', { 
      id: data.id,
      anonymousId 
    });
    
    res.status(201).json({
      success: true,
      data: data,
      message: 'Report created successfully'
    });
  } catch (error) {
    logError(error, req);
    
    if (error.message.startsWith('VALIDATION_ERROR')) {
      return res.status(400).json({
        error: 'Validation failed',
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'Failed to create report',
      message: error.message
    });
  }
});

/**
 * PATCH /api/reports/:id
 * Update a report (only by creator)
 * Requires: X-Anonymous-Id header
 */
router.patch('/:id', requireAnonymousId, async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;
    
    // Check if report exists and belongs to user
    const { data: report, error: checkError } = await supabase
      .from('reports')
      .select('anonymous_id')
      .eq('id', id)
      .maybeSingle();
    
    if (checkError) {
      logError(checkError, req);
      return res.status(500).json({
        error: 'Failed to verify report',
        message: checkError.message
      });
    }
    
    if (!report) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }
    
    if (report.anonymous_id !== anonymousId) {
      return res.status(403).json({
        error: 'Forbidden: You can only update your own reports'
      });
    }
    
    // Build update object dynamically
    const updateData = {};
    
    if (req.body.title !== undefined) {
      updateData.title = req.body.title.trim();
    }
    
    if (req.body.description !== undefined) {
      updateData.description = req.body.description.trim();
    }
    
    if (req.body.status !== undefined) {
      updateData.status = req.body.status;
    }
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'No fields to update'
      });
    }
    
    // Update report using Supabase client
    // Using .eq('anonymous_id', anonymousId) as additional security check
    const { data: updatedReport, error: updateError } = await supabase
      .from('reports')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('anonymous_id', anonymousId)
      .select()
      .single();
    
    if (updateError) {
      logError(updateError, req);
      return res.status(500).json({
        error: 'Failed to update report',
        message: updateError.message
      });
    }
    
    if (!updatedReport) {
      return res.status(403).json({
        error: 'Forbidden: You can only update your own reports'
      });
    }
    
    logSuccess('Report updated', { id, anonymousId });
    
    res.json({
      success: true,
      data: updatedReport,
      message: 'Report updated successfully'
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to update report',
      message: error.message
    });
  }
});

/**
 * POST /api/reports/:id/favorite
 * Toggle favorite status for a report
 * Requires: X-Anonymous-Id header
 */
router.post('/:id/favorite', requireAnonymousId, async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;
    
    // Verify report exists
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    
    if (reportError) {
      logError(reportError, req);
      return res.status(500).json({
        error: 'Failed to verify report',
        message: reportError.message
      });
    }
    
    if (!report) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }
    
    // Ensure anonymous user exists
    try {
      await ensureAnonymousUser(anonymousId);
    } catch (error) {
      logError(error, req);
      return res.status(500).json({
        error: 'Failed to ensure anonymous user',
        message: error.message
      });
    }
    
    // Check if favorite already exists
    const { data: existingFavorite, error: checkError } = await supabase
      .from('favorites')
      .select('id')
      .eq('anonymous_id', anonymousId)
      .eq('report_id', id)
      .maybeSingle();
    
    if (checkError) {
      logError(checkError, req);
      return res.status(500).json({
        error: 'Failed to check favorite status',
        message: checkError.message
      });
    }
    
    if (existingFavorite) {
      // Remove favorite (toggle off)
      const { error: deleteError } = await supabase
        .from('favorites')
        .delete()
        .eq('id', existingFavorite.id);
      
      if (deleteError) {
        logError(deleteError, req);
        return res.status(500).json({
          error: 'Failed to remove favorite',
          message: deleteError.message
        });
      }
      
      res.json({
        success: true,
        data: {
          is_favorite: false
        },
        message: 'Favorite removed successfully'
      });
    } else {
      // Add favorite (toggle on)
      const { data: newFavorite, error: insertError } = await supabase
        .from('favorites')
        .insert({
          anonymous_id: anonymousId,
          report_id: id
        })
        .select()
        .single();
      
      if (insertError) {
        // Check if it's a unique constraint violation (shouldn't happen but handle it)
        if (insertError.code === '23505' || insertError.message.includes('unique')) {
          res.json({
            success: true,
            data: {
              is_favorite: true
            },
            message: 'Already favorited'
          });
        } else {
          logError(insertError, req);
          return res.status(500).json({
            error: 'Failed to add favorite',
            message: insertError.message
          });
        }
      } else {
        res.json({
          success: true,
          data: {
            is_favorite: true
          },
          message: 'Favorite added successfully'
        });
      }
    }
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to toggle favorite',
      message: error.message
    });
  }
});

/**
 * POST /api/reports/:id/flag
 * Flag a report as inappropriate
 * Requires: X-Anonymous-Id header
 */
router.post('/:id/flag', requireAnonymousId, async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;
    const reason = req.body.reason || null;
    
    // Verify report exists and get owner
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('id, anonymous_id')
      .eq('id', id)
      .maybeSingle();
    
    if (reportError) {
      logError(reportError, req);
      return res.status(500).json({
        error: 'Failed to verify report',
        message: reportError.message
      });
    }
    
    if (!report) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }
    
    // Check if user is trying to flag their own report
    if (report.anonymous_id === anonymousId) {
      return res.status(403).json({
        error: 'You cannot flag your own report'
      });
    }
    
    // Ensure anonymous user exists
    try {
      await ensureAnonymousUser(anonymousId);
    } catch (error) {
      logError(error, req);
      return res.status(500).json({
        error: 'Failed to ensure anonymous user',
        message: error.message
      });
    }
    
    // Check if already flagged
    const { data: existingFlag, error: checkError } = await supabase
      .from('report_flags')
      .select('id')
      .eq('anonymous_id', anonymousId)
      .eq('report_id', id)
      .maybeSingle();
    
    if (checkError) {
      logError(checkError, req);
      return res.status(500).json({
        error: 'Failed to check flag status',
        message: checkError.message
      });
    }
    
    if (existingFlag) {
      return res.status(409).json({
        error: 'Report already flagged by this user',
        message: 'You have already flagged this report'
      });
    }
    
    // Create flag
    const { data: newFlag, error: insertError } = await supabase
      .from('report_flags')
      .insert({
        anonymous_id: anonymousId,
        report_id: id,
        reason: reason
      })
      .select()
      .single();
    
    if (insertError) {
      logError(insertError, req);
      return res.status(500).json({
        error: 'Failed to flag report',
        message: insertError.message
      });
    }
    
    res.status(201).json({
      success: true,
      data: {
        is_flagged: true,
        flag_id: newFlag.id
      },
      message: 'Report flagged successfully'
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to flag report',
      message: error.message
    });
  }
});

/**
 * POST /api/reports/:id/images
 * Upload images for a report
 * Requires: X-Anonymous-Id header
 * Accepts: multipart/form-data with image files
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max per file
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only jpg, jpeg, png, and webp are allowed.'), false);
    }
  },
});

router.post('/:id/images', requireAnonymousId, upload.array('images', 5), async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'No images provided'
      });
    }

    // Verify report exists and belongs to user
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('id, anonymous_id')
      .eq('id', id)
      .maybeSingle();

    if (reportError) {
      logError(reportError, req);
      return res.status(500).json({
        error: 'Failed to verify report',
        message: reportError.message
      });
    }

    if (!report) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    if (report.anonymous_id !== anonymousId) {
      return res.status(403).json({
        error: 'Forbidden: You can only upload images to your own reports'
      });
    }

    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      return res.status(500).json({
        error: 'Storage service not configured',
        message: 'SUPABASE_SERVICE_ROLE_KEY is required for image uploads'
      });
    }

    // Upload files to Supabase Storage
    const imageUrls = [];
    const bucketName = 'report-images';

    for (const file of files) {
      try {
        // Generate unique filename
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from(bucketName)
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (uploadError) {
          logError(uploadError, req);
          throw new Error(`Failed to upload ${file.originalname}: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
          .from(bucketName)
          .getPublicUrl(fileName);

        if (urlData?.publicUrl) {
          imageUrls.push(urlData.publicUrl);
        } else {
          throw new Error(`Failed to get public URL for ${file.originalname}`);
        }
      } catch (fileError) {
        logError(fileError, req);
        // Continue with other files, but log the error
        console.error(`Error uploading file ${file.originalname}:`, fileError.message);
      }
    }

    if (imageUrls.length === 0) {
      return res.status(500).json({
        error: 'Failed to upload any images',
        message: 'All image uploads failed'
      });
    }

    // Update report with image URLs (replace completely)
    const { data: updatedReport, error: updateError } = await supabase
      .from('reports')
      .update({
        image_urls: imageUrls
      })
      .eq('id', id)
      .eq('anonymous_id', anonymousId)
      .select()
      .single();

    if (updateError) {
      logError(updateError, req);
      return res.status(500).json({
        error: 'Failed to update report with image URLs',
        message: updateError.message
      });
    }

    logSuccess('Images uploaded', { id, anonymousId, count: imageUrls.length });

    res.json({
      success: true,
      data: {
        image_urls: imageUrls
      },
      message: `Successfully uploaded ${imageUrls.length} image(s)`
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to upload images',
      message: error.message
    });
  }
});

export default router;

