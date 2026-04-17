import { useEffect, useMemo, useState } from "react";

function UsersSection({
                          users,
                          loading,
                          error,
                          success,
                          onUpdateRole,
                          onClearMessages,
                      }) {
    const [roleDrafts, setRoleDrafts] = useState({});
    const [savingUserId, setSavingUserId] = useState(null);


    const roleSummary = useMemo(() => {
        return users.reduce(
            (acc, user) => {
                if (user.role === "admin") {
                    acc.admins += 1;
                } else {
                    acc.users += 1;
                }

                return acc;
            },
            { admins: 0, users: 0 }
        );
    }, [users]);

    useEffect(() => {
        setRoleDrafts(
            users.reduce((acc, user) => {
                acc[user.id] = user.role;
                return acc;
            }, {})
        );
    }, [users]);

    async function handleSave(userId) {
        onClearMessages();
        setSavingUserId(userId);
        await onUpdateRole(userId, roleDrafts[userId]);
        setSavingUserId(null);
    }

    return (
        <section className="admin-section">
            <div className="admin-section-header">
                <div>
                    <h2>Usuarios</h2>
                    <p>Consulta cuentas registradas y ajusta permisos de acceso.</p>
                </div>
            </div>

            <div className="admin-summary-strip">
                <article className="admin-summary-item admin-summary-item-accent">
                    <span className="admin-summary-label">Administradores</span>
                    <strong>{roleSummary.admins}</strong>
                </article>

                <article className="admin-summary-item">
                    <span className="admin-summary-label">Usuarios estandar</span>
                    <strong>{roleSummary.users}</strong>
                </article>
            </div>

            <div className="admin-grid admin-grid-single">
                <article className="admin-panel">
                    <div className="admin-panel-header">
                        <h3>Gestion de roles</h3>
                        <p>
                            {loading
                                ? "Cargando usuarios..."
                                : `${users.length} usuario${users.length === 1 ? "" : "s"} registrado${users.length === 1 ? "" : "s"}.`}
                        </p>
                    </div>

                    {error && <p className="admin-feedback admin-feedback-error">{error}</p>}
                    {success && (
                        <p className="admin-feedback admin-feedback-success">{success}</p>
                    )}

                    {loading ? (
                        <p className="admin-empty">Cargando usuarios...</p>
                    ) : users.length === 0 ? (
                        <p className="admin-empty">No hay usuarios cargados para mostrar.</p>
                    ) : (
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead>
                                <tr>
                                    <th>Usuario</th>
                                    <th>Email</th>
                                    <th>Rol actual</th>
                                    <th>Nuevo rol</th>
                                    <th>Accion</th>
                                </tr>
                                </thead>
                                <tbody>
                                {users.map((user) => (
                                    <tr key={user.id}>
                                        <td>{user.username || user.nombre || "Sin nombre"}</td>
                                        <td>{user.email || "-"}</td>
                                        <td>
                                                <span
                                                    className={`admin-role-badge ${
                                                        user.role === "admin" ? "is-admin" : "is-user"
                                                    }`}
                                                >
                                                    {user.role}
                                                </span>
                                        </td>
                                        <td>
                                            <select
                                                className="admin-role-select"
                                                value={roleDrafts[user.id] || user.role}
                                                onChange={(event) =>
                                                    setRoleDrafts((prev) => ({
                                                        ...prev,
                                                        [user.id]: event.target.value,
                                                    }))
                                                }
                                            >
                                                <option value="user">user</option>
                                                <option value="admin">admin</option>
                                            </select>
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="admin-button admin-button-primary"
                                                disabled={
                                                    savingUserId === user.id ||
                                                    (roleDrafts[user.id] || user.role) ===
                                                    user.role
                                                }
                                                onClick={() => handleSave(user.id)}
                                            >
                                                {savingUserId === user.id
                                                    ? "Guardando..."
                                                    : "Actualizar"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </article>
            </div>
        </section>
    );
}

export default UsersSection;
