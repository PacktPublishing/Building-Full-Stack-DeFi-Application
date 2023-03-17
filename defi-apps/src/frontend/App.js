import Layout from './components/Layout';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { theme } from './styles/theme';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TokenOperations from './features/TokenOperations';

function App() {
  return <ThemeProvider theme={theme}>
    <CssBaseline />
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path='/' element={<TokenOperations />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  </ThemeProvider>;
}

export default App;
