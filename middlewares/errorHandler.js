export default function errorHandler(err, req, res, next) {
  return res.status(500).json({
    message: "Error Server",
    error:
      process.env.ENVIRONMENT === "development"
        ? err.message
        : "Error Server Internal",
  });
}
