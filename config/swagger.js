const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Online Auction API",
      version: "1.0.0",
      description: "API documentation for the Online Auction System",
    },
    servers: [
      {
        url: "http://localhost:3000/api",
        description: "Local server",
      },
    ],
  },
  apis: ["./routes/*.js"], // Path to API route files
};

const swaggerSpec = swaggerJsdoc(options);

function setupSwagger(app) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

module.exports = setupSwagger;
