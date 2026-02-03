
import { supabaseAdmin } from '../src/utils/db.js';

async function cleanup() {
    console.log('🧹 Limpiando tabla admin_users (Identidades Legacy)...\n');

    const KEEP_EMAIL = 'juanchi@safespot.com';

    // 1. Identificar Admin Destino (Juanchi)
    const { data: juanchiUser, error: juanchiError } = await supabaseAdmin
        .from('admin_users')
        .select('id')
        .eq('email', KEEP_EMAIL)
        .single();

    if (juanchiError || !juanchiUser) {
        console.error('❌ CRÍTICO: No se encontró al usuario "Juanchi". Abortando para evitar pérdida de datos.');
        console.error(juanchiError);
        process.exit(1);
    }
    const TARGET_ID = juanchiUser.id;
    console.log(`✅ Usuario destino: ${KEEP_EMAIL} (${TARGET_ID})`);

    // 2. Identificar Usuarios a Eliminar
    const { data: allAdmins, error: fetchError } = await supabaseAdmin
        .from('admin_users')
        .select('id, email, alias, role')
        .neq('email', KEEP_EMAIL);

    if (fetchError) {
        console.error('❌ Error fetching admins:', fetchError);
        process.exit(1);
    }

    if (allAdmins.length === 0) {
        console.log('✅ La tabla ya está limpia.');
        process.exit(0);
    }

    const idsToDelete = allAdmins.map(u => u.id);
    console.log(`⚠️ Se eliminarán ${idsToDelete.length} usuarios:`);
    allAdmins.forEach(u => console.log(`   - ${u.alias || 'Sin Alias'} (${u.email}) [${u.id}]`));

    // 3. REASIGNAR HISTORIAL (FK Fix)
    console.log('\n🔄 Reasignando registros dependientes...');

    // A. Moderation Notes
    // Check count first
    const { count: notesCount } = await supabaseAdmin
        .from('moderation_notes')
        .select('*', { count: 'exact', head: true })
        .in('admin_id', idsToDelete);

    if (notesCount > 0) {
        console.log(`   -> Reasignando ${notesCount} notas de moderación...`);
        const { error: updateNotesError } = await supabaseAdmin
            .from('moderation_notes')
            .update({ admin_id: TARGET_ID })
            .in('admin_id', idsToDelete);

        if (updateNotesError) {
            console.error('❌ FALLO al reasignar notas:', updateNotesError);
            process.exit(1);
        }
        console.log('   ✅ Notas reasignadas.');
    } else {
        console.log('   -> No hay notas para reasignar.');
    }

    // B. Moderation Actions
    const { count: actionsCount } = await supabaseAdmin
        .from('moderation_actions')
        .select('*', { count: 'exact', head: true })
        .in('actor_id', idsToDelete); // Check column name carefully. Usually actor_id in log tables.

    if (actionsCount > 0) {
        console.log(`   -> Reasignando ${actionsCount} acciones de moderación...`);
        // Note: moderation_actions might track 'actor_id' for generic actions.
        const { error: updateActionsError } = await supabaseAdmin
            .from('moderation_actions')
            .update({ actor_id: TARGET_ID })
            .in('actor_id', idsToDelete);

        if (updateActionsError) {
            console.error('❌ FALLO al reasignar acciones:', updateActionsError);
            process.exit(1);
        }
        console.log('   ✅ Acciones reasignadas.');
    } else {
        console.log('   -> No hay acciones para reasignar.');
    }

    // 4. EJECUTAR BORRADO
    console.log('\n🗑️ Ejecutando borrado final...');
    const { error: deleteError } = await supabaseAdmin
        .from('admin_users')
        .delete()
        .in('id', idsToDelete);

    if (deleteError) {
        console.error('❌ ERROR FINAL borrando usuarios:', deleteError.message);
        console.error('   Hint: Puede haber otras tablas FK (ej: asignaciones de tareas). Revisar schema.');
    } else {
        console.log('✅ Limpieza exitosa. Tabla admin_users saneada.');
    }

    process.exit(0);
}

cleanup();
