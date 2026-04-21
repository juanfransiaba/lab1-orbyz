import { useEffect, useState } from "react";
import "./LandingPage.css";

import img1 from "../../assets/images/imagen.jpg";
import img2 from "../../assets/images/imagen7.jpg";
import img3 from "../../assets/images/imagen5.jpg";
import img4 from "../../assets/images/imagen4.jpg";
import img5 from "../../assets/images/imagen6.jpg";
import logo from "../../assets/images/logo.png";
import {Link} from "react-router-dom";

function LandingPage() {
    const images = [img1, img2, img3, img4, img5];
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrent((prev) => (prev + 1) % images.length);
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="landing-page">
            <header className="landing-header">
                <a className="landing-brand" href="#inicio" aria-label="Orbyz inicio">
                    <img src={logo} alt="ORBYZ logo" className="landing-logo" />
                </a>

                <nav className="landing-nav" aria-label="Acciones principales">
                    <Link className="landing-nav-link" to="/login">
                        Iniciar sesión
                    </Link>
                    <Link className="landing-nav-button" to="/register">
                        Registrarse
                    </Link>
                </nav>
            </header>

            <main className="landing-main" id="inicio">
                <section className="landing-hero">
                    <div className="landing-hero-background">
                        {images.map((image, index) => (
                            <img
                                key={index}
                                src={image}
                                alt={`Slide ${index + 1}`}
                                className={`landing-hero-image ${index === current ? "active" : ""}`}
                            />
                        ))}
                        <div className="landing-hero-overlay" />
                    </div>

                    <div className="landing-hero-content">
                        <p className="landing-kicker">Juego de geografia social</p>
                        <h1>ORBYZ</h1>
                        <h2>
                            Aprende geografía jugando con una experiencia clara y competitiva.
                        </h2>

                        <div className="landing-actions">
                            <Link className="landing-primary-cta" to="/register">
                                Empezar
                            </Link>
                            <Link className="landing-secondary-cta" to="/login">
                                Iniciar sesion
                            </Link>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default LandingPage;
