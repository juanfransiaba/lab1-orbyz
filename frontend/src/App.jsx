import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/Login/Login.jsx";
import LandingPage from "./pages/LandingPage/LandingPage.jsx";
import Register from "./pages/Register/Register.jsx";
import MainMenu from "./pages/Menu/MainMenu.jsx";
import Profile from "./pages/Profile/Profile.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Admin from "./pages/Admin/Admin.jsx";
import PlayOffline from "./pages/PlayOffline/PlayOffline.jsx";
import ContinentSelection from "./pages/PlayOffline/ContinentSelection.jsx";
import CountryByCapital from "./pages/PlayOffline/modes/CountryByCapital.jsx";
import CapitalByCountry from "./pages/PlayOffline/modes/CapitalByCountry.jsx";
import CountryByShape from "./pages/PlayOffline/modes/CountryByShape.jsx";
import CountryByContinent from "./pages/PlayOffline/modes/CountryByContinent.jsx";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                <Route
                    path="/mainMenu"
                    element={
                        <ProtectedRoute>
                            <MainMenu />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/profile"
                    element={
                        <ProtectedRoute>
                            <Profile />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/admin"
                    element={
                        <ProtectedRoute>
                            <Admin />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/offline"
                    element={
                        <ProtectedRoute>
                            <PlayOffline />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/offline/country-by-capital"
                    element={
                        <ProtectedRoute>
                            <CountryByCapital />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/offline/capital-by-country"
                    element={
                        <ProtectedRoute>
                            <CapitalByCountry />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/offline/country-by-shape"
                    element={
                        <ProtectedRoute>
                            <CountryByShape />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/offline/continent-selection"
                    element={
                        <ProtectedRoute>
                            <ContinentSelection />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/offline/continent-selection/:continent"
                    element={
                        <ProtectedRoute>
                            <CountryByContinent />
                        </ProtectedRoute>
                    }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
