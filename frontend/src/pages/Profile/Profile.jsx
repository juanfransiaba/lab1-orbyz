import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import "./Profile.css";
import logo from "../../assets/images/logo.png";

function Profile() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const storedUser = localStorage.getItem("user");

        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    return (
        <div className="profile-page">
            <header className="profile-header">
                <div className="profile-header-left">
                    <Link to="/mainmenu" className="profile-back-button">
                        Volver
                    </Link>
                </div>

                <div className="profile-header-center">
                    <img src={logo} alt="Logo ORBYZ" className="profile-header-logo" />
                    <h1>Perfil</h1>
                </div>


            </header>

            <main className="profile-main">
                <section className="profile-top-section">
                    <div className="profile-card profile-user-card">
                        <div className="profile-user-top">
                            <div className="profile-avatar">
                                <span>
                                    {user?.username ? user.username.charAt(0).toUpperCase() : "U"}
                                </span>
                            </div>

                            <div className="profile-user-info">
                                <p className="profile-label">Jugador</p>
                                <h2>{user?.username || "Usuario"}</h2>
                                <p className="profile-subtitle">
                                    Administrá tu cuenta, tus datos y tu progreso.
                                </p>
                            </div>
                        </div>

                        <div className="profile-fields">
                            <div className="profile-field">
                                <label>Nombre de usuario</label>
                                <div className="profile-field-box">
                                    {user?.username || ""}
                                </div>
                            </div>

                            <div className="profile-field">
                                <label>Correo electrónico</label>
                                <div className="profile-field-box">
                                    {user?.email || ""}
                                </div>
                            </div>

                            <div className="profile-field">
                                <label>Contraseña</label>
                                <div className="profile-field-box">
                                    ********
                                </div>
                            </div>
                        </div>
                    </div>

                    <aside className="profile-card profile-side-card">
                        <h3>Accesos rápidos</h3>

                        <div className="profile-side-actions">
                            <Link to="/ranking" className="profile-side-button">
                                Ver ranking
                            </Link>

                            <Link to="/mainmenu" className="profile-side-button">
                                Ver mis amigos
                            </Link>

                            <Link to="/history" className="profile-side-button">
                                Ver historial completo
                            </Link>
                        </div>

                        <button className="profile-logout-button">
                            Cerrar sesión
                        </button>
                    </aside>
                </section>

                <section className="profile-card profile-history-card">
                    <div className="profile-history-header">
                        <div>
                            <p className="profile-label">Actividad</p>
                            <h3>Historial reciente</h3>
                        </div>

                        <Link to="/history" className="profile-history-link">
                            Ver todo
                        </Link>
                    </div>

                    <div className="profile-history-empty">
                        Todavía no hay partidas registradas.
                    </div>
                </section>
            </main>
        </div>
    );
}

export default Profile;