import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import { useAuth } from './lib/auth';
import Login from './pages/Login';
import Perfil from './pages/Perfil';
import Painel from './pages/Painel';
import Associados from './pages/Associados';
import VeiculosRotas from './pages/VeiculosRotas';
import Financeiro from './pages/Financeiro';
import ControlesFinanceiros from './pages/ControlesFinanceiros';
import Contratos from './pages/Contratos';
import Transporte from './pages/Transporte';
import Comunicacao from './pages/Comunicacao';
import Relatorios from './pages/Relatorios';
import Administracao from './pages/Administracao';

export default function App() {
  const { usuario } = useAuth();
  if (!usuario) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }
  return (
    <Layout>
      <Routes>
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/" element={<Painel />} />
          <Route path="/associados" element={<Associados />} />
          <Route path="/veiculos-rotas" element={<VeiculosRotas />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/controles-financeiros" element={<ControlesFinanceiros />} />
          <Route path="/contratos" element={<Contratos />} />
          <Route path="/transporte" element={<Transporte />} />
          <Route path="/comunicacao" element={<Comunicacao />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/administracao" element={<Administracao />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}
