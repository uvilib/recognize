const path = require("path");
const fs = require("fs");
const express = require("express");
var WebSocketServer = new require("ws");

const app = express();
const port = process.env.PORT || 3000;

const basePath = path.join(__dirname, "../public");
const modelsPath = path.join(__dirname, "../public", "/labeled_images/");

var webSocketServer = new WebSocketServer.Server({
  port: 5000,
});

let labels = [];
function getLabels() {
  labels = fs
    .readFileSync(__dirname + "/file.txt")
    .toString()
    .split("\n");
}

const clients = {};

webSocketServer.on("connection", function (ws) {
  const id = Math.random();
  clients[id] = ws;

  getLabels();

  for (var key in clients) {
    clients[key].send(JSON.stringify(labels));
  }

  ws.on("message", function (message) {
    const data = JSON.parse(message);

    var strImage = data.file.replace(/^data:image\/[a-z]+;base64,/, "");

    const buffer = Buffer.from(strImage, "base64");

    try {
      if (!fs.existsSync(data.name)) {
        fs.mkdirSync(modelsPath + data.name);
        fs.writeFileSync(`${modelsPath}${data.name}/1.jpg`, buffer);
        fs.appendFileSync(__dirname + "/file.txt", `\n${data.name}`);
        getLabels();

        console.log(labels);

        for (var key in clients) {
          clients[key].send(JSON.stringify(labels));
        }
      }
    } catch (err) {
      console.error(err);
    }
  });
});

app.use(express.static(basePath));

app.listen(port, () => {
  console.log("Server started on post " + port);
});
