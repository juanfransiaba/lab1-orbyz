import { useEffect, useState } from "react";

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

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
                    <p>Visualiza usuarios y actualiza sus roles.</p>
                </div>
            </div>

            <div className="admin-grid admin-grid-single">
                <article className="admin-panel">
                    <div className="admin-panel-header">
                        <h3>Gestion de roles</h3>
                        <p>Datos obtenidos.</p>
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
                                    <th>Nombre</th>
                                    <th>Email</th>
                                    <th>Rol actual</th>
                                    <th>Nuevo rol</th>
                                    <th>Accion</th>
                                </tr>
                                </thead>
                                <tbody>
                                {users.map((user) => (
                                    <tr key={user.id}>
                                        <td>{user.nombre || "Sin nombre"}</td>
                                        <td>{user.email || "-"}</td>
                                        <td>
                                                <span className="admin-role-badge">
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
                                                    : "Actualizar rol"}
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
