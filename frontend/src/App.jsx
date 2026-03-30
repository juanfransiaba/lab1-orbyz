import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login/Login.jsx";
import LandingPage from "./pages/LandingPage/LandingPage.jsx";
import Register from "./pages/Register/Register.jsx";
import MainMenu from "./pages/Menu/MainMenu.jsx";
import Profile from "./pages/Profile/Profile.jsx";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path={"/mainMenu"} element={<MainMenu />} />
                <Route path={"/profile"} element={<Profile />} />

            </Routes>
        </BrowserRouter>
    );
}

export default App;