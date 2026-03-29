import { useEffect, useState } from "react";
import "./Login.css";


import img1 from "../../assets/images/imagen.jpg";
import img2 from "../../assets/images/imagen2.jpg";
import img3 from "../../assets/images/imagen3.jpg";
import img4 from "../../assets/images/imagen4.jpg";
import img5 from "../../assets/images/imagen5.jpg";
import img6 from "../../assets/images/imagen6.jpg";
import img7 from "../../assets/images/imagen7.jpg";





function Login() {
    const images = [img1, img2, img3,img4,img5,img6,img7];
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrent((prev) => (prev + 1) % images.length);
        }, 3000); // cambia cada 3s

        return () => clearInterval(interval);
    }, [images.length]);

    return (
        <div className="login-page">
            <section className="login-left">
                <div className="login-content">
                    <span className="login-tag">Log in</span>

                    <h1 className="login-title">Bienvenido de vuelta</h1>

                    <form className="login-form">
                        <div className="form-group">
                            <label htmlFor="name">Nombre</label>
                            <input type="text" id="name" placeholder="Ingresá tu nombre" />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Correo electrónico</label>
                            <input
                                type="email"
                                id="email"
                                placeholder="Ingresá tu correo"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Contraseña</label>
                            <input
                                type="password"
                                id="password"
                                placeholder="Ingresá tu contraseña"
                            />
                        </div>

                        <button type="submit" className="login-button">
                            Iniciar sesión
                        </button>
                    </form>

                    <div className="login-links">
                        <p>
                            No tenés cuenta? <a href="/register">Registrarse</a>
                        </p>
                        <p>
                            ¿Olvidaste tu contraseña? <a href="/recover">Recuperar</a>
                        </p>
                    </div>
                </div>
            </section>

            {/* 🔥 CAROUSEL CON FADE */}
            <section className="login-right">
                {images.map((img, index) => (
                    <img
                        key={index}
                        src={img}
                        alt="Login visual"
                        className={`login-image ${
                            index === current ? "active" : ""
                        }`}
                    />
                ))}
            </section>
        </div>
    );
}

export default Login;