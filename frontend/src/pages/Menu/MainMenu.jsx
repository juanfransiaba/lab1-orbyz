import { Link } from "react-router-dom";
import "./MainMenu.css";
import logo from "../../assets/images/logo.png";

import jugarImg from "../../assets/images/imagen.jpg";
import onlineImg from "../../assets/images/imagen7.jpg";
import perfilImg from "../../assets/images/imagen5.jpg";
import rankingImg from "../../assets/images/imagen2.jpg";

function MainMenu() {
    const menuOptions = [
        {
            title: "Jugar",
            eyebrow: "Modo principal",
            description: "Explorá los modos principales y empezá una nueva partida.",
            to: "/jugar",
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

                <div className="main-menu-header-spacer" />
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
