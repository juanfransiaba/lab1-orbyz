import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "./MainMenu.css";
import logo from "../../assets/images/logo.png";

import jugarImg from "../../assets/images/imagen.jpg";
import onlineImg from "../../assets/images/imagen7.jpg";
import perfilImg from "../../assets/images/imagen5.jpg";
import rankingImg from "../../assets/images/imagen2.jpg";

function MainMenu() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);

    const menuOptions = [
        {
            title: "Jugar",
            eyebrow: "Modo principal",
            description: "Explorá los modos principales y empezá una nueva partida.",
            to: "/offline",
            image: jugarImg,
        },
        {
            title: "Modo online",
            eyebrow: "Multijugador",
            description: "Competí con otras personas en desafíos geográficos en tiempo real.",
            to: "/online",
            image: onlineImg,
        },
        {
            title: "Perfil",
            eyebrow: "Tu cuenta",
            description: "Personalizá tu cuenta, progreso y preferencias de juego.",
            to: "/profile",
            image: perfilImg,
        },
        {
            title: "Ranking",
            eyebrow: "Competitivo",
            description: "Seguí tu posición y compará tu rendimiento global.",
            to: "/ranking",
            image: rankingImg,
        },
    ];

    useEffect(() => {
        const token = localStorage.getItem("token");

        if (!token) {
            navigate("/login");
            return;
        }

        const fetchProfile = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/user/profile`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                const data = await response.json();

                if (!response.ok) {
                    localStorage.removeItem("token");
                    navigate("/login");
                    return;
                }

                setUser(data);
            } catch (error) {
                navigate("/login");
            }
        };

        void fetchProfile();
    }, [navigate]);

    return (
        <div className="main-menu-page">
            <header className="main-menu-header">
                <div className="main-menu-header-glow" />

                <div className="main-menu-logo-box">
                    <img src={logo} alt="Logo de ORBYZ" className="main-menu-logo" />
                </div>

                <div className="main-menu-title-wrap">
                    <span className="main-menu-title-kicker">Geography Game System</span>
                    <h1 className="main-menu-title">ORBYZ</h1>
                </div>

                <div className="main-menu-header-actions">
                    {user?.roles === "admin" && (
                        <Link to="/admin" className="main-menu-manage-button">
                            Gestionar
                        </Link>
                    )}
                </div>
            </header>

            <section className="main-menu-options">
                {menuOptions.map((option) => (
                    <Link to={option.to} className="main-menu-row" key={option.title}>
                        <div className="main-menu-row-overlay" />

                        <div className="main-menu-row-left">
                            <span className="main-menu-row-eyebrow">{option.eyebrow}</span>
                            <h3>{option.title}</h3>
                            <p>{option.description}</p>
                        </div>

                        <div className="main-menu-row-right">
                            <img
                                src={option.image}
                                alt={option.title}
                                className="main-menu-row-image"
                            />
                        </div>
                    </Link>
                ))}
            </section>
        </div>
    );
}

export default MainMenu;