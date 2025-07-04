const functions = require("firebase-functions");
const express = require("express");


const users = require("./api/users/user");
const contracts = require("./api/contracts/contracts");
const invoices = require("./api/invoices/invoices");

const app = express();

// Middleware to parse JSON requests
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: false }));

// Users and accounts routes
app.use("/users", users);

// Contracts routes
app.use("/contracts", contracts);

// Invoices routes
app.use("/invoices",invoices);

exports.api = functions.https.onRequest(app);
