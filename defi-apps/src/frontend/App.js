import Layout from './components/Layout';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { theme } from './styles/theme';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TokenOperations from './features/TokenOperations';
import { Web3ReactProvider } from '@web3-react/core'
import { getLibrary } from './components/Wallet';

function App() {
  return <Web3ReactProvider getLibrary={getLibrary}>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path='/' element={<TokenOperations />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ThemeProvider>;
  </Web3ReactProvider>
}

export default App;
