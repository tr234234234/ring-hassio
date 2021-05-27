//Far majority of this code by Dgreif https://github.com/dgreif/ring/examples/browser_example.ts

import { log } from 'console';
import 'dotenv/config'
import { RingApi } from 'ring-client-api'
import { promisify} from 'util'
const fs = require('fs'),
  path = require('path'),
  http = require('http'),
  url = require('url'),
  zlib = require('zlib') 
  var Jimp = require('jimp');
 

const PORT = process.env.RING_PORT;
//
const CAMERA_NAME = process.env.CAMERA_NAME;
var chosenCamera = CAMERA_NAME;
var ringApi;
var inCall = false;
var sipSession;
var camera;
var publicOutputDirectory;
var sockets;
var nextSocketId;
var server;
var imageBuffer;

function sleep(milliseconds) {
  const date = Date.now();
  console.log(`time ${date}`)
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
  console.log(`time ${Date.now()}`)
}

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

// (B) DELETE FILES WITH SPECIFIED EXTENSION ONLY
const delExt = (folder, ext) => {
  // (B1) GET FILES
  let files =
  fs.readdirSync(folder, { withFileTypes: true })
  .filter(dirent => {
    if (!dirent.isFile()) { return false; }
    return path.extname(dirent.name) == ext;
  })
  .map(dirent => dirent.name);

  // (B2) DELETE FILES
  if (files.length!=0) {
    for (let f of files) {
      let file = folder + f;
      try {
        fs.unlinkSync(file);
        console.log("DELETED " + file);
      } catch (err) {
        console.error(err);
      }
    }
  }
};

/**
 * This example creates an hls stream which is viewable in a browser
 * It also starts web app to view the stream at http://localhost:PORT
 **/

 async function startStream() {
  var today = new Date();
  var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
  console.log(`Starting stream ${time}`)
  try{
    sipSession = await camera.streamVideo({
      video: [
        '-vcodec',
        'libx264'
      ],
      output: [
        '-vf',
        'drawtext= text=Frame\: %{localtime}:  rate=1: fontcolor=white: box=1: boxcolor=0x00000000@1: fontsize=30',
        '-t',
        '30',
        '-preset',
        'veryfast',
        '-g',
        '25',
        '-sc_threshold',
        '0',
        '-f',
        'hls',
        '-hls_time',
        '2',
      //'-hls_playlist_type',
      //'vod',
      '-hls_list_size',
      '21',
      '-hls_flags',
      'delete_segments',
      path.join(publicOutputDirectory, 'stream.m3u8')
      ]
    })
  } catch (e) {
    console.log(e)
  }


  sipSession.onCallEnded.subscribe(async () => {
    var today = new Date();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    console.log(`The call has ended... ${time}`)
    
    //await server.close(function() {console.log('Server closed!');});
    
    //app.stop()
    //console.log('Restarting server')
    await delay(10000);
    //inCall = false;
    //console.log('incall set to false')
    //delExt(publicOutputDirectory, ".ts");
    //await startHttpServer();
    stopServer();
  })

 

  //setTimeout(async function() {
  //
  //},  60 * 1000) // 10*60*1000 Stop after 10 minutes.

}

async function stopServer() {
  var today = new Date();
  var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
  console.log(`Stopping session... ${time}`)
  await server.close(function() {console.log('Server closed!');});
  // Destroy all open sockets
  for (var socketId in sockets) {
    console.log('socket', socketId, 'destroyed');
    sockets[socketId].destroy();
  }
  nextSocketId = 0;
  console.log('setting incall to false')
  inCall = false;
  sipSession.stop();
  delExt(publicOutputDirectory, ".ts");
  console.log('Restarting server')
  await delay(10000);
  await startHttpServer();
}

async function getCamera() {
  var cameras = await ringApi.getCameras();
  var camera;
  //
  if (chosenCamera) {
    for (var i=0; i < cameras.length; i++) {
      var cameraName = cameras[i].initialData.description;
      console.log(`Checking If ${cameraName} Is the same as the camera we are looking for (${chosenCamera})`);
      if (chosenCamera == cameraName) {
        camera = cameras[i];
        console.log(`Matched ${cameraName}`);
      } 
    }
  } else {
    camera = cameras[0]
  }
  //
  if (!cameras) {
    console.log('No cameras found')
    return
  }
  //
  return camera
}

async function connectToRing() {
  
  ringApi = new RingApi({
    // Refresh token is used when 2fa is on
    refreshToken: process.env.RING_REFRESH_TOKEN!,
    controlCenterDisplayName: 'live-stream',
    debug: true
  })
  console.log('Connected to Ring API')

  // Automatically replace refresh tokens, as they now expire after each use.
  // See: https://github.com/dgreif/ring/wiki/Refresh-Tokens#refresh-token-expiration
  ringApi.onRefreshTokenUpdated.subscribe(
    async ({ newRefreshToken, oldRefreshToken }) => {
        console.log('Refresh Token Updated') // Changed from example, don't write new token to log.

        if (!oldRefreshToken) {
        return
        }

        const currentConfig = await promisify(fs.readFile)('/data/options.json'),
        updatedConfig = currentConfig
            .toString()
            .replace(oldRefreshToken, newRefreshToken)

        await promisify(fs.writeFile)('/data/options.json', updatedConfig)
      }
    )
}

async function startHttpServer() {
  server = http.createServer(function (req, res) {
    // Get URL
    var uri = url.parse(req.url).pathname;
    console.log('requested uri: '+uri)
    // If Accessing The Main Page
    if (uri == '/index.html' || uri == '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.write('<html><head><title>Ring Livestream</title></head><body>');
      res.write('<h1>Welcome to your Ring Livestream!</h1>');
      res.write(`<video width="352" height="198" controls autoplay src="public/stream.m3u8"></video>`);
      res.write(`<br/>If you cannot see the video above open <a href="public/stream.m3u8">the stream</a> in a player such as VLC.`);
      res.end();
      return;
    }

    if (uri == '/start') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.write('<html><head><title>Start Livestream</title></head><body>');
      res.write('<h1>Start Ring Livestream!</h1>');
      res.end();
      startStream()
      return;
    }

    if (uri == '/stop') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.write('<html><head><title>Stop Livestream</title></head><body>');
      res.write('<h1>Stop Ring Livestream!</h1>');
      res.end();
      console.log('Stopping call from command...')
      stopServer();
      return;
    }

    var filename = path.join("./", uri);
    console.log('mapped filename: '+filename)
    fs.exists(filename, async function (exists) {
      if (!exists) {
        console.log('file not found: ' + filename);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.write('file not found: %s\n', filename);
        res.end();
      }  else {
           console.log('sending file: ' + filename);
           switch (path.extname(uri)) {
           case '.m3u8':
             // start the sip if we are not in a call
             console.log(`inCall = ${inCall}`)
              if(inCall == false) {
                //await startStream();
              }
              var today = new Date();
              var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
              if(inCall == false) {
                console.log(`Sleeping... ${time}`);
                //await delay(3500);
                inCall = true;
              }
             
            //
            today = new Date();
            time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
            console.log(`writing file ${time}`)
            fs.readFile(filename, function (err, contents) {
            if (err) {
              res.writeHead(500);
              res.end();
            } else if (contents) {
              res.writeHead(200,
                {'Content-Type':
                'application/vnd.apple.mpegurl'});
              var ae = req.headers['accept-encoding'];
              if (ae && ae.match(/\bgzip\b/)) {
                zlib.gzip(contents, function (err, zip) {
                  if (err) throw err;
                  res.writeHead(200,
                      {'content-encoding': 'gzip'});
                  res.end(zip);
                });
              } else {
                res.end(contents, 'utf-8');
              }
            } else {
              console.log('empty playlist');
              res.writeHead(500);
              res.end();
            }
          });
          break;
        case '.ts':
          if (uri == '/public/stream0.ts') {
            console.log('sleep 1 sec')
            //await delay(1000);
          }
          res.writeHead(200, { 'Content-Type':
              'video/MP2T' });
          var stream = fs.createReadStream(filename,
              { bufferSize: 64 * 1024 });
          stream.pipe(res);
          break;
        case '.png':
          // Grab new snapshot
          try {
              const snapshotBuffer = await camera.getSnapshot().catch(error => {
                  console.log('[ERROR] Unable to retrieve snapshot because:' + error.message)
              })
              //add text to image
              Jimp.read(snapshotBuffer)
                .then(image => {
                  // success case, the file was saved
                  var today = new Date();' '
                  var time = today.toLocaleString('en-US');
                  Jimp.loadFont(Jimp.FONT_SANS_16_WHITE).then(font => {
                    image.print(font, 10, 1, `${time}`);
                    image.getBuffer(Jimp.MIME_PNG, (err, imageBuffer) => {
                      //console.log(imageBuffer);
                      //console.log(snapshotBuffer)
                      res.writeHead(200,{'Content-Type':'image/png'});
                      res.write(imageBuffer);
                      res.end();
                    });
                    });
                })
                .catch(err => {
                  // Handle an exception.
                  console.log ('Cound not add text to image')
                });
                //console.log(imageBuffer);
                //console.log(snapshotBuffer)
              //res.writeHead(200,{'Content-Type':'image/png'});
              //res.write(snapshotBuffer);
              //res.end();
          
              fs.writeFile(publicOutputDirectory + '/snapshot.png', snapshotBuffer, (err) => {
                  // throws an error, you could also catch it here
                  if (err) throw err;
                  
                  // success case, the file was saved
                  var today = new Date();
                  var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
                  console.log(`Snapshot saved! ${time}`);
          
                  })
          } catch (e) {
              // Failed to retrieve snapshot. We send text of notification along with error image.
              // Most common errors are due to expired API token, or battery-powered camera taking too long to wake.
              console.log('Unable to get snapshot.')
              console.error(e.name + ': ' + e.message)
                  //sendNotification(notifyTitle, notifyMessage, 'error.png')
          }
          break;
        default:
          console.log('unknown file type: ' +
              path.extname(uri));
          res.writeHead(500);
          res.end();
        }
      }
  });
  }).listen(PORT);

   // Maintain a hash of all connected sockets
   sockets = {};
   nextSocketId = 0;
   server.on('connection', function (socket) {
     // Add a newly connected socket
     var socketId = nextSocketId++;
     sockets[socketId] = socket;
     console.log('socket', socketId, 'opened');

     // Remove the socket when it closes
     socket.on('close', function () {
       console.log('socket', socketId, 'closed');
       delete sockets[socketId];
     });

     // Extend socket lifetime for demo purposes
     socket.setTimeout(4000);
   });
   console.log('Started server, listening on port '+PORT+'.')
}

async function runMain () {
  if(!('RING_REFRESH_TOKEN' in process.env) || !('RING_PORT' in process.env) || !('CAMERA_NAME' in process.env)) {
    console.log('Missing environment variables. Check RING_REFRESH_TOKEN, RING_PORT and CAMERA_NAME are set.')
    process.exit()
  }
  else {
    await connectToRing();
    camera = await getCamera();

    publicOutputDirectory = path.join('public/')
    console.log('output directory: '+publicOutputDirectory)

    if (!(await promisify(fs.exists)(publicOutputDirectory))) {
      await promisify(fs.mkdir)(publicOutputDirectory)
    }
    
    await startHttpServer();
  }
}

runMain();


