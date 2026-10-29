import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import { useAuth } from './lib/auth';
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import EsqueciSenha from './pages/EsqueciSenha';
import RedefinirSenha from './pages/RedefinirSenha';
import ConcluirCadastro from './pages/ConcluirCadastro';
import VerificarEmail from './pages/VerificarEmail';
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
import Perfil from './pages/Perfil';

export default function App() {
  const { usuario, carregando } = useAuth();
  if (carregando) return <p style={{ padding: 24 }}>Carregando…</p>;
  return (
    <Routes>
      {/* telas públicas */}
      <Route path="/login" element={usuario ? <Navigate to="/" /> : <Login />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/esqueci-senha" element={<EsqueciSenha />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route path="/concluir-cadastro" element={<ConcluirCadastro />} />
      <Route path="/verificar-email" element={<VerificarEmail />} />
      {/* telas internas: exigem login */}
      <Route element={usuario ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<Painel />} />
        <Route path="associados" element={<Associados />} />
        <Route path="veiculos-rotas" element={<VeiculosRotas />} />
        <Route path="financeiro" element={<Financeiro />} />
        <Route path="controles-financeiros" element={<ControlesFinanceiros />} />
        <Route path="contratos" element={<Contratos />} />
        <Route path="transporte" element={<Transporte />} />
        <Route path="comunicacao" element={<Comunicacao />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="administracao" element={<Administracao />} />
        <Route path="perfil" element={<Perfil />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
