import { Link } from 'react-router-dom'
import { MapPin, Github, Twitter, Mail } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-dark-border bg-dark-card">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
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
              <a
                href="mailto:contacto@safespot.com"
                className="text-foreground/70 hover:text-neon-green transition-colors"
              >
                <Mail className="w-5 h-5" />
              </a>
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
                  to="/crear-reporte"
                  className="text-foreground/70 hover:text-neon-green transition-colors"
                >
                  Crear Reporte
                </Link>
              </li>
              <li>
                <Link
                  to="/perfil"
                  className="text-foreground/70 hover:text-neon-green transition-colors"
                >
                  Mi Perfil
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Column */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/terminos"
                  className="text-foreground/70 hover:text-neon-green transition-colors"
                >
                  Términos y Condiciones
                </Link>
              </li>
              <li>
                <Link
                  to="/privacidad"
                  className="text-foreground/70 hover:text-neon-green transition-colors"
                >
                  Política de Privacidad
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright Bar */}
        <div className="border-t border-dark-border mt-8 pt-8 flex flex-col md:flex-row justify-between">
          <p className="text-sm text-foreground/70 mb-2 md:mb-0">
            © 2024 SafeSpot. Todos los derechos reservados.
          </p>
          <p className="text-sm text-foreground/70">
            Hecho con ❤️ para la comunidad
          </p>
        </div>
      </div>
    </footer>
  )
}
