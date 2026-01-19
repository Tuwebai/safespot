import { Link } from 'react-router-dom'
import { MapPin, Github, Twitter, Mail, ShieldCheck, Heart } from 'lucide-react'
import { useState, lazy, Suspense } from 'react'
import { StatusIndicator } from './StatusIndicator'
import { useNavigate } from 'react-router-dom'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { InstallAppButton } from './InstallAppButton'

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
      <footer className="relative bg-dark-card pt-16 pb-8 border-t border-dark-border z-10">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-neon-green/50 to-transparent" />

        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          {/* Top Section: Brand & Install */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 pb-8 border-b border-white/5 gap-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-green to-emerald-600 flex items-center justify-center shadow-lg shadow-neon-green/20">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-white">SafeSpot</div>
                <div className="text-xs text-white/50 uppercase tracking-widest font-medium">Enterprise Security</div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <StatusIndicator />
              <InstallAppButton />
            </div>
          </div>

          {/* Main Grid Content */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12 mb-16">

            {/* Column 1: Mission */}
            <div className="col-span-2 lg:col-span-2 space-y-6 pr-4">
              <p className="text-foreground/60 leading-relaxed max-w-sm">
                Plataforma colaborativa de nueva generación para la seguridad comunitaria.
                Reportá incidentes en tiempo real y recuperá lo que te pertenece con la ayuda de tu red local.
              </p>

              <div className="flex items-center space-x-4">
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
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Producto</h4>
              <ul className="space-y-2">
                <FooterLink to="/reportes">Explorar Reportes</FooterLink>
                <FooterLink to="/explorar">Mapa en Vivo</FooterLink>
                <FooterButton onClick={handleCreateReport}>Reportar</FooterButton>
                <FooterLink to="/comunidad">Comunidad</FooterLink>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Soporte</h4>
              <ul className="space-y-2">
                <FooterLink to="/como-funciona">Cómo Funciona</FooterLink>
                <FooterLink to="/guia-seguridad">Guía de Seguridad</FooterLink>
                <FooterLink to="/faq">FAQ / Ayuda</FooterLink>
                <FooterButton onClick={() => setIsContactOpen(true)}>Contactar Soporte</FooterButton>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Compañía</h4>
              <ul className="space-y-2">
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
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 py-8 border-t border-white/5 text-sm text-foreground/40">
            <div className="flex items-center gap-2">
              <span>&copy; {currentYear} SafeSpot Platform</span>
              <span className="hidden md:inline mx-2">&middot;</span>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-xs">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <span>v2.4.0-pro</span>
              </span>
            </div>

            <div className="flex items-center gap-6">
              <Link to="/status" className="hover:text-foreground transition-colors">Estado del Sistema</Link>
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
        className="text-sm text-foreground/60 hover:text-neon-green transition-colors duration-200 block"
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
        className="text-sm text-foreground/60 hover:text-neon-green transition-colors duration-200 block text-left w-full"
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
      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-foreground/60 hover:text-neon-green transition-all duration-300"
      aria-label={label}
    >
      <Icon className="w-5 h-5" />
    </a>
  )
}
