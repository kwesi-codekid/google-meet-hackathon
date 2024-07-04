const express = require("express");
const path = require("path");
const fs = require("fs");
const fileUpload = require("express-fileupload");
const app = express();
const server = app.listen(3000, function(){
    console.log("Listening on port 3000");
});

const io = require("socket.io")(server, {
    allowEIO3: true // false by default
});

app.use(express.static(path.join(__dirname, "")));
app.use(fileUpload());

var userConnections = [];

// Handle user connection
io.on("connection", (socket) => {
    console.log("socket id is ", socket.id);

    // Handle user joining a meeting
    socket.on("userconnect", (data) => {
        console.log("userconnect", data.displayName, data.meetingid);
        var other_users = userConnections.filter((p) => p.meeting_id == data.meetingid);
        userConnections.push({
            connectionId: socket.id,
            user_id: data.displayName,
            meeting_id: data.meetingid,
        });
        var userCount = userConnections.length;
        console.log(userCount);

        other_users.forEach((v) => {
            socket.to(v.connectionId).emit("inform_others_about_me", {
                other_user_id: data.displayName,
                connId: socket.id,
                userNumber: userCount,
            });
        });
        socket.emit("inform_me_about_other_user", other_users);
    });

    // Handle SDP process
    socket.on("SDPProcess", (data) => {
        socket.to(data.to_connid).emit("SDPProcess", {
            message: data.message,
            from_connid: socket.id,
        });
    });

    // Handle sending messages
    socket.on("sendMessage", (msg) => {
        console.log(msg);
        var mUser = userConnections.find((p) => p.connectionId == socket.id);
        if (mUser) {
            var meetingid = mUser.meeting_id;
            var from = mUser.user_id;
            var list = userConnections.filter((p) => p.meeting_id == meetingid);
            list.forEach((v) => {
                socket.to(v.connectionId).emit("showChatMessage", {
                    message: msg,
                    from: from,
                });
            });
        }
    });

    // Handle file transfer
    socket.on("fileTransferToOther", (msg) => {
        console.log(msg);
        var mUser = userConnections.find((p) => p.connectionId == socket.id);
        if (mUser) {
            var meetingid = mUser.meeting_id;
            var from = mUser.user_id;
            var list = userConnections.filter((p) => p.meeting_id == meetingid);
            list.forEach((v) => {
                socket.to(v.connectionId).emit("showFileMessage", {
                    username: msg.username,
                    meetingid: msg.meetingid,
                    filePath: msg.filePath,
                    fileName: msg.fileName,
                });
            });
        }
    });

    // Handle video state changes
    socket.on("videoStateChanged", (data) => {
        var mUser = userConnections.find((p) => p.connectionId == socket.id);
        if (mUser) {
            var meetingid = mUser.meeting_id;
            var from = mUser.user_id;
            var list = userConnections.filter((p) => p.meeting_id == meetingid);
            list.forEach((v) => {
                socket.to(v.connectionId).emit("videoStateChanged", {
                    ...data,
                    from: from
                });
            });
        }
    });

    // Handle screen share state changes
    socket.on("screenShareStateChanged", (data) => {
        var mUser = userConnections.find((p) => p.connectionId == socket.id);
        if (mUser) {
            var meetingid = mUser.meeting_id;
            var from = mUser.user_id;
            var list = userConnections.filter((p) => p.meeting_id == meetingid);
            list.forEach((v) => {
                socket.to(v.connectionId).emit("screenShareStateChanged", {
                    ...data,
                    from: from
                });
            });
        }
    });

    // Handle user disconnect
    socket.on("disconnect", function() {
        console.log("Disconnected");
        var disUser = userConnections.find((p) => p.connectionId == socket.id);

        if (disUser) {
            var meetingid = disUser.meeting_id;
            userConnections = userConnections.filter((p) => p.connectionId != socket.id);

            var list = userConnections.filter((p) => p.meeting_id == meetingid);
            list.forEach((v) => {
                var userNumberAfUserLeave = userConnections.length;
                socket.to(v.connectionId).emit("inform_other_about_disconnected_user", {
                    connId: socket.id,
                    uNumber: userNumberAfUserLeave,
                });
            });
        }
    });
});
// Handle file upload
app.post("/attachimg", function(req, res) {
    var data = req.body;
    var imageFile = req.files.zipfile;
    console.log(imageFile);
    var dir = "public/attachment/" + data.meeting_id + "/";
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    imageFile.mv("public/attachment/" + data.meeting_id + "/" + imageFile.name, function(error) {
        if (error) {
            console.log("couldn't upload the image file , error: ", error);
            res.status(500).send("Error uploading file");
        } else {
            console.log("Image file successfully uploaded");
            res.status(200).send("File uploaded");
        }
    });
});
