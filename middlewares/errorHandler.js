export default function errorHandler(err, req, res, next){
    const status = err.status || 500;
    return res.json({
        error: process.env.ENVIRONMENT === "development" ? err : "INTERNAL ERROR",
        message: status === 500 ? "Errore interno del server" : err.message
    });
}