export default function notFound(req, res, next) {
    res.status(404).json({
        error: "NOT FOUND",
        message: "Risorsa non trovata"
    });
}