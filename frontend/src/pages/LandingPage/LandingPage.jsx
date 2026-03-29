import { useEffect, useState } from "react";
import "./LandingPage.css";

import img1 from "../../assets/images/imagen.jpg";
import img2 from "../../assets/images/imagen7.jpg";
import img3 from "../../assets/images/imagen5.jpg";
import img4 from "../../assets/images/imagen4.jpg";
import img5 from "../../assets/images/imagen6.jpg";

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
                    <span className="landing-brand-mark">O</span>
                    <span className="landing-brand-name">ORBYZ</span>
                </a>

                <nav className="landing-nav" aria-label="Acciones principales">
                    <a className="landing-nav-link" href="/login">
                        Iniciar sesion
                    </a>
                    <a className="landing-nav-button" href="#registro">
                        Registrarse
                    </a>
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
                        <p className="landing-description">
                            Memoriza mapas, responde mas rapido y reta a tus amigos en una web
                            pensada para aprender geografia de forma simple y entretenida.
                        </p>

                        <div className="landing-actions">
                            <a className="landing-primary-cta" href="#jugar">
                                Empezar
                            </a>
                            <a className="landing-secondary-cta" href="/login">
                                Iniciar sesion
                            </a>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default LandingPage;