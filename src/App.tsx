import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { Home } from '@/pages/Home'
import { Reportes } from '@/pages/Reportes'
import { CrearReporte } from '@/pages/CrearReporte'
import { DetalleReporte } from '@/pages/DetalleReporte'
import { Explorar } from '@/pages/Explorar'
import { Gamificacion } from '@/pages/Gamificacion'
import { Perfil } from '@/pages/Perfil'

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/crear-reporte" element={<CrearReporte />} />
          <Route path="/reporte/:id" element={<DetalleReporte />} />
          <Route path="/explorar" element={<Explorar />} />
          <Route path="/gamificacion" element={<Gamificacion />} />
          <Route path="/perfil" element={<Perfil />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App

