import { Link } from 'react-router-dom'
import { MapPin, Github, Twitter, Mail, ShieldCheck, Heart } from 'lucide-react'
import { useState, lazy, Suspense } from 'react'
import { StatusIndicator } from './StatusIndicator'
import { useNavigate } from 'react-router-dom'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { InstallAppButton } from './InstallAppButton'
import { AppVersion, APP_VERSION_DISPLAY } from '@/lib/version';

// ✅ PERFORMANCE FIX: Lazy load ContactModal (5 KB gzip) - Footer is on ALL pages
const ContactModal = lazy(() => import('@/components/contact/ContactModal').then(m => ({ default: m.ContactModal })))

export function Footer() {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const donationLink = "https://link.mercadopago.com.ar/safespotapp";
  const currentYear = new Date().getFullYear();
  const navigate = useNavigate()
  const { checkAuth } = useAuthGuard()

  // 🛡️ PRE-AUTH GUARD
  const handleCreateReport = () => {
    if (!checkAuth()) return;
    navigate('/crear-reporte');
  };

  return (
    <>
      {/* ContactModal - Lazy loaded */}
      {isContactOpen && (
        <Suspense fallback={null}>
          <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
        </Suspense>
      )}

      {/* Enterprise Gradient Border Top */}
      <footer className="relative bg-card pt-12 pb-8 border-t border-border z-10">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="container mx-auto max-w-7xl px-4 lg:px-8">

          {/* Top Section: Brand & Install */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 pb-8 border-b border-border/50 gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
                <MapPin className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-foreground">SafeSpot</div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Enterprise Security</div>
              </div>
            </div>

            <div className="flex items-center gap-3 lg:gap-4">
              <StatusIndicator />
              <InstallAppButton />
            </div>
          </div>

          {/* Main Grid Content */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 lg:gap-10 mb-12">

            {/* Column 1: Mission */}
            <div className="col-span-2 lg:col-span-2 space-y-4 pr-4">
              <p className="text-foreground/60 leading-relaxed max-w-sm">
                Plataforma colaborativa de nueva generación para la seguridad comunitaria.
                Reportá incidentes en tiempo real y recuperá lo que te pertenece con la ayuda de tu red local.
              </p>

              <div className="flex items-center gap-3">
                <SocialLink href="https://github.com" icon={Github} label="GitHub" />
                <SocialLink href="https://twitter.com" icon={Twitter} label="Twitter" />
                <button
                  onClick={() => setIsContactOpen(true)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-foreground/60 hover:text-neon-green transition-all duration-300"
                  aria-label="Contact"
                >
                  <Mail className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Links Columns */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Producto</h4>
              <ul className="space-y-2">
                <FooterLink to="/reportes">Explorar Reportes</FooterLink>
                <FooterLink to="/explorar">Mapa en Vivo</FooterLink>
                <FooterButton onClick={handleCreateReport}>Reportar</FooterButton>
                <FooterLink to="/comunidad">Comunidad</FooterLink>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Soporte</h4>
              <ul className="space-y-2">
                <FooterLink to="/como-funciona">Cómo Funciona</FooterLink>
                <FooterLink to="/guia-seguridad">Guía de Seguridad</FooterLink>
                <FooterLink to="/faq">FAQ / Ayuda</FooterLink>
                <FooterButton onClick={() => setIsContactOpen(true)}>Contactar Soporte</FooterButton>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Compañía</h4>
              <ul className="space-y-2">
                <FooterLink to="/blog">Blog & Novedades</FooterLink>
                <FooterLink to="/terminos">Términos de Servicio</FooterLink>
                <FooterLink to="/privacidad">Política de Privacidad</FooterLink>
                <li>
                  <a
                    href={donationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-2 text-sm text-foreground/60 hover:text-white transition-colors mt-4"
                  >
                    <Heart className="w-4 h-4 text-sky-500 group-hover:fill-sky-500 transition-colors" />
                    <span className="font-medium text-sky-500 group-hover:text-sky-400">Donar al Proyecto</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar: Copyright & Compliance */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 py-6 border-t border-border/50 text-xs text-muted-foreground">
            {/* Izquierda: Copyright y versión */}
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              <span>&copy; {currentYear} SafeSpot</span>
              <span className="hidden sm:inline text-border">|</span>
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono" title={`Deploy ID: ${AppVersion.deployId}`}>
                <ShieldCheck className="w-3 h-3 text-primary" />
                <span className="hidden sm:inline">{APP_VERSION_DISPLAY}</span>
                <span className="sm:hidden">v{AppVersion.appVersion}</span>
              </span>
            </div>

            {/* Derecha: Links legales */}
            <div className="flex items-center gap-4">
              <Link to="/status" className="hover:text-foreground transition-colors">Sistema</Link>
              <Link to="/cookies" className="hover:text-foreground transition-colors">Cookies</Link>
            </div>
          </div>

        </div>
      </footer>
    </>
  )
}

// Sub-components for cleaner code
function FooterLink({ to, children }: { to: string, children: React.ReactNode }) {
  return (
    <li>
      <Link
        to={to}
        className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200 block"
      >
        {children}
      </Link>
    </li>
  )
}

function FooterButton({ onClick, children }: { onClick: () => void, children: React.ReactNode }) {
  return (
    <li>
      <button
        onClick={onClick}
        className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200 block text-left w-full"
      >
        {children}
      </button>
    </li>
  )
}

function SocialLink({ href, icon: Icon, label }: { href: string, icon: any, label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-primary transition-all duration-300"
      aria-label={label}
    >
      <Icon className="w-5 h-5" />
    </a>
  )
}
