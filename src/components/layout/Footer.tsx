import { Link } from 'react-router-dom'
import { MapPin, Github, Twitter, Mail } from 'lucide-react'
import { useState } from 'react'
import { ContactModal } from '@/components/contact/ContactModal'

export function Footer() {
  const [isContactOpen, setIsContactOpen] = useState(false);
  // Use standard URL for all platforms - Android browser handles MP app redirect automatically
  const donationLink = "https://link.mercadopago.com.ar/safespotapp"; //commit

  return (
    <>
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />

      <footer className="bg-dark-card border-t border-dark-border py-6">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          {/* Main Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-8">
            {/* Branding Column (Spans 2 columns) */}
            <div className="md:col-span-2">
              {/* Logo Group */}
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-neon-green to-green-400 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-dark-bg" />
                </div>
                <div className="text-xl font-bold gradient-text">SafeSpot</div>
              </div>

              {/* Description */}
              <p className="text-foreground/70 mb-4 max-w-md">
                Plataforma colaborativa para reportar robos y recuperar objetos robados junto con tu comunidad.
              </p>

              {/* Social Icons */}
              <div className="flex items-center space-x-4">
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground/70 hover:text-neon-green transition-colors"
                >
                  <Github className="w-5 h-5" />
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground/70 hover:text-neon-green transition-colors"
                >
                  <Twitter className="w-5 h-5" />
                </a>
                <button
                  onClick={() => setIsContactOpen(true)}
                  className="text-foreground/70 hover:text-neon-green transition-colors"
                >
                  <Mail className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Links Column */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Enlaces Rápidos</h3>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/reportes"
                    className="text-foreground/70 hover:text-neon-green transition-colors"
                  >
                    Ver Reportes
                  </Link>
                </li>
                <li>
                  <Link
                    to="/explorar"
                    className="text-foreground/70 hover:text-neon-green transition-colors"
                  >
                    Mapa Interactivo
                  </Link>
                </li>
                <li>
                  <Link
                    to="/comunidad"
                    className="text-foreground/70 hover:text-neon-green transition-colors"
                  >
                    Comunidad
                  </Link>
                </li>
                <li>
                  <Link
                    to="/crear-reporte"
                    className="text-foreground/70 hover:text-neon-green transition-colors"
                  >
                    Crear Reporte
                  </Link>
                </li>
                <li>
                  <button
                    onClick={() => setIsContactOpen(true)}
                    className="text-foreground/70 hover:text-neon-green transition-colors flex items-center gap-2"
                  >
                    Contacto
                  </button>
                </li>
                <li>
                  <a
                    href={donationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neon-green hover:text-neon-green/80 font-medium transition-colors flex items-center gap-2"
                  >
                    💙 Apoyar Proyecto
                  </a>
                </li>
              </ul>
            </div>

            {/* Support Column */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Producto</h3>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/como-funciona"
                    className="text-foreground/70 hover:text-neon-green transition-colors"
                  >
                    Cómo funciona
                  </Link>
                </li>
                <li>
                  <Link
                    to="/faq"
                    className="text-foreground/70 hover:text-neon-green transition-colors"
                  >
                    Preguntas Frecuentes
                  </Link>
                </li>
                <li>
                  <Link
                    to="/guia-seguridad"
                    className="text-foreground/70 hover:text-neon-green transition-colors"
                  >
                    Guía de Seguridad
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal Column */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Legal</h3>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/terminos"
                    className="text-foreground/70 hover:text-neon-green transition-colors"
                  >
                    Términos
                  </Link>
                </li>
                <li>
                  <Link
                    to="/privacidad"
                    className="text-foreground/70 hover:text-neon-green transition-colors"
                  >
                    Privacidad
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Copyright Bar */}
          <div className="border-t border-dark-border mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-foreground/70">
                © 2024 SafeSpot. Todos los derechos reservados.
              </p>
            </div>
            <p className="text-sm text-foreground/70">
              Hecho con ❤️ para la comunidad
            </p>
          </div >
        </div >
      </footer>
    </>
  )
}
