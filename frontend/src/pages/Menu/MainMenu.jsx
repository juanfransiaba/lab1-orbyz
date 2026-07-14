import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "./MainMenu.css";
import logo from "../../assets/images/logo.png";

import jugarImg from "../../assets/images/imagen.jpg";
import onlineImg from "../../assets/images/imagen7.jpg";
import tournamentsImg from "../../../public/images/paises/myanmar.jpg";
import perfilImg from "../../assets/images/imagen5.jpg";
import rankingImg from "../../assets/images/imagen2.jpg";

function MainMenu() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);

    const menuOptions = [
        {
            title: "Jugar",
            eyebrow: "Modo principal",
            description: "Explora los modos principales y empeza una nueva partida.",
            to: "/offline",
            image: jugarImg,
        },
        {
            title: "Modo online",
            eyebrow: "Multijugador",
            description: "Competi con otras personas en desafios geograficos en tiempo real.",
            to: "/online",
            image: onlineImg,
        },
        {
            title: "Torneos",
            eyebrow: "Competencia",
            description: "Prepara llaves, fechas y desafios especiales para competir.",
            to: "/tournaments",
            image: tournamentsImg,
        },
        {
            title: "Perfil",
            eyebrow: "Tu cuenta",
            description: "Personaliza tu cuenta, historial y progreso de juego.",
            to: "/profile",
            image: perfilImg,
        },
        {
            title: "Ranking",
            eyebrow: "Tabla global",
            description: "Mira la tabla de puntajes y compara posiciones.",
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
            } catch {
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
                    <Link to="/profile" className="main-menu-profile-chip">
                        <div className="main-menu-profile-avatar">
                            {user?.avatar?.imageSrc ? (
                                <img
                                    src={user.avatar.imageSrc}
                                    alt={user.avatar.name || "Avatar"}
                                />
                            ) : (
                                <span>
                                    {user?.avatar?.icon ||
                                        (user?.username
                                            ? user.username.charAt(0).toUpperCase()
                                            : "U")}
                                </span>
                            )}
                        </div>

                        <div className="main-menu-profile-copy">
                            <span className="main-menu-profile-name">
                                {user?.username || "Usuario"}
                            </span>
                        </div>
                    </Link>

                    <Link
                        to="/store"
                        className="main-menu-store-button"
                        aria-label="Ir a la tienda"
                        title="Tienda"
                    >
                        <StoreIcon />
                    </Link>
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

function StoreIcon() {
    return (
        <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <path
                className="main-menu-store-roof"
                d="M11 19.2 14.5 9h19L37 19.2H11Z"
            />
            <path
                className="main-menu-store-awning"
                d="M11 19.2h26v3.1c0 2.4-2 4.4-4.4 4.4-1.8 0-3.4-1.1-4.1-2.7-.8 1.6-2.4 2.7-4.2 2.7s-3.4-1.1-4.2-2.7c-.8 1.6-2.4 2.7-4.2 2.7-2.7 0-4.9-2.1-4.9-4.8v-2.7Z"
            />
            <path
                className="main-menu-store-body"
                d="M14.2 26.5h19.6v12.7H14.2V26.5Z"
            />
            <path
                className="main-menu-store-door"
                d="M21.2 30.1h5.6v9.1h-5.6v-9.1Z"
            />
            <path
                className="main-menu-store-window"
                d="M29.2 30.2h3.1v3.2h-3.1v-3.2Z"
            />
        </svg>
    );
}

export default MainMenu;
