import express from "express";
import helmet from "helmet";
import cors from "cors";
import * as middlewares from "./middlewares";
import chatAPI from "./api/chat-api";
import MessageResponse from "./interfaces/MessageResponse";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get<{}, MessageResponse>("/", async (req, res) =>
  res.json({
    message: "8ai Chatbot Backend API",
  })
);

app.use("/chat", chatAPI);

app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

export default app;
