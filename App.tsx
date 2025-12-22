import React from 'react';
import { HashRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Home from './pages/Home';
import Search from './pages/Search';
import Detail from './pages/Detail';
import Profile from './pages/Profile';
import BottomNav from './components/BottomNav';

const MainLayout = () => {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="/detail/:id" element={<Detail />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;