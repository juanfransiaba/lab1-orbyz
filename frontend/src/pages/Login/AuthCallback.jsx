import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "./Login.css";

function AuthCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [error, setError] = useState("");

    useEffect(() => {
        const token = searchParams.get("token");
        const oauthError = searchParams.get("error");
        const nextParam = searchParams.get("next");
        const next =
            nextParam && nextParam.startsWith("/") ? nextParam : "/mainmenu";

        if (token) {
            localStorage.setItem("token", token);
            navigate(next, { replace: true });
            return;
        }

        setError(oauthError || "No se pudo completar el inicio de sesion.");
    }, [navigate, searchParams]);

    return (
        <div className="login-page auth-callback-page">
            <section className="login-left">
                <div className="login-content auth-callback-content">
                    <span className="login-tag">OAuth</span>
                    <h1 className="login-title">
                        {error ? "No se pudo iniciar sesion" : "Iniciando sesion..."}
                    </h1>
                    {error ? (
                        <>
                            <p className="login-error">{error}</p>
                            <Link className="login-button auth-callback-link" to="/login">
                                Volver al login
                            </Link>
                        </>
                    ) : (
                        <p className="auth-callback-message">
                            Estamos validando tu cuenta.
                        </p>
                    )}
                </div>
            </section>
        </div>
    );
}

export default AuthCallback;
