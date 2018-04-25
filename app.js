'use strict';





module.exports = function(sslRedirect) {

  // Bare bones Express server to test Docker
  const express = require('express');
  const bodyParser = require('body-parser');
  const request = require('request');
  const cors = require('cors');
  var app = express();

  app.use(express.static('public'))

  app.use(bodyParser.json({limit: '50mb'}));
  app.use(cors());

  var serverStatus=null
  var serverInfo=null

  // 900000 == 15 min
  var serverLifeSpan = ((900000 * 4) * 5)
  var destroyDropletTimeout = null

  if (!process.env.DO_KEY){
    console.error("No DO_KEY defined")
    process.exit()
  }
  if (!process.env.DO_FLOAT_IP){
    console.error("No DO_FLOAT_IP defined")
    process.exit()
  }
  if (!process.env.DO_IMAGE_ID){
    console.error("No DO_IMAGE_ID defined")
    process.exit()
  }
  if (!process.env.DO_SSH_ID){
    console.error("No DO_SSH_ID defined")
    process.exit()
  }  
  var token = process.env.DO_KEY
  var floatIp = process.env.DO_FLOAT_IP
  var imageId = process.env.DO_IMAGE_ID
  var sshId = process.env.DO_SSH_ID


  var assignedFloatIp = false



  var destroyDroplet = (cb) =>{

    if (serverInfo && serverInfo.id){
      var options = {
        url: 'https://api.digitalocean.com/v2/droplets/'+serverInfo.id,
        method: 'delete',
        headers: {
          "Authorization":"Bearer " + token
        }
      };

      function callback(error, response, body) {
        if (!error && response.statusCode == 204) {
            assignedFloatIp=false
            serverStatus='down'
            serverInfo=null
            console.log(body)
            if (cb) cb(true)                
        }else{
          console.error(error,response.statusCode)
          if (cb) cb(false)
        }
      }
      request(options, callback);
    }else{
      if (cb) cb(false)
      return false
    }
    
  }
  var spawnDroplet = (cb) =>{
    // before we start wait a sec and see if there is a server spawing already
    setTimeout(()=>{
      getDropletId(()=>{
        if (serverStatus==='down'){
          var options = {
            url: 'https://api.digitalocean.com/v2/droplets/',
            headers: {
              "Authorization":"Bearer " + token
            },
            method: 'POST',
            json: {
              "names": ['nerserver'],
              "region": 'nyc3',
              "size": "s-8vcpu-32gb",
              "image": imageId,
              "ssh_keys": [sshId],
              "backups": false,
              "ipv6": false,
              "user_data": null,
              "private_networking": null,
              "tags": [
                "nerserver"
              ]
            }

          };

          function callback(error, response, body) {

            if (!error && response.statusCode == 202) {
              try{
                assignedFloatIp=false

                console.log(body)

                // when to turn it off
                clearTimeout(destroyDropletTimeout)
                destroyDropletTimeout = setTimeout(()=>{
                  destroyDroplet()
                },serverLifeSpan)


              }catch(E){
                console.error(E)  
              }
                  
            }else{
              console.error(error,response.statusCode,body)
            }
          }
          request(options, callback);


        }
      })
    },1000)


  }
  var assignFloatingIp = (cb) =>{
    var options = {
      url: `https://api.digitalocean.com/v2/floating_ips/${floatIp}/actions`,
      headers: {
        "Authorization":"Bearer " + token
      },
      method: 'POST',
      json: {
        "type": "assign",
        "droplet_id" : serverInfo.id
      }

    };

    function callback(error, response, body) {
      if (!error) {
        try{
          // var info = JSON.parse(body);
          console.log(body)
          assignedFloatIp=true
          // if (info.droplets.length==0){
          //   serverStatus='down'
          // }
          // console.log(info) 
        }catch(E){
          console.log(response.statusCode,body)
          console.error(E)  
        }
            
      }else{
        console.error(error,response.statusCode,body)
      }
    }
    request(options, callback);

  }

  var getDropletId = (cb) =>{
    var options = {
      url: 'https://api.digitalocean.com/v2/droplets?tag_name=nerserver&per_page=1',
      headers: {
        "Authorization":"Bearer " + token
      }
    };

    function callback(error, response, body) {
      if (!error && response.statusCode == 200) {
        try{
          var info = JSON.parse(body);
          if (info.droplets.length==0){
            serverStatus='down'
          }else{
            serverStatus=info.droplets[0]['status']
            serverInfo=info.droplets[0]

            if (serverStatus=='active' && assignedFloatIp==false){
              assignFloatingIp()              
              console.log('assining float IP')
              assignedFloatIp=true
            }            
            if (serverStatus=='active' && !destroyDropletTimeout){
                destroyDropletTimeout = setTimeout(()=>{
                  destroyDroplet()
                },serverLifeSpan)
            }
          }
          if (cb) cb(serverStatus)
        }catch(E){
          console.error(E)  
          if (cb) cb(false)
        }
              
      }else{
        console.error(error,response.statusCode)
        if (cb) cb(false)
      }
    }
    request(options, callback);
  }

  // Force HTTPS redirect unless we are using localhost or unit testing with superagent.
  function httpsRedirect(req, res, next) {
    if (req.protocol === 'https'
      || req.header('X-Forwarded-Proto') === 'https'
      || req.header('User-Agent').match(/^node-superagent/)
      || req.hostname === 'localhost') {
      return next();
    }

    res.status(301).redirect("https://" + req.headers.host + req.url);
  }

  if (sslRedirect) {
    app.use(httpsRedirect);
  }



  app.get('/ping', function(req, res) {
    res.status(200).json({uptime:format(process.uptime()), tools:Object.keys(config)});

  })

  app.get('/', function(req, res) {
    // res.redirect('https://semanticlab.github.io/DADAlytics-ner-demo/');
    res.status(200).json({uptime:'supppppp'});
  })

  app.get('/spawn', function(req, res) {
    spawnDroplet()
    res.status(200).json(true);
  })
  app.get('/status', function(req, res) {
    res.status(200).json(serverStatus);
  })

  app.get('/kill', function(req, res) {
    destroyDroplet()
    res.status(200).json(serverStatus);
  })





  setInterval(getDropletId,1000)

  // setTimeout(()=>{

  //   console.log('hey')
  //   spawnDroplet()
  //   assignFloatingIp()

  // },5000)


  // setTimeout(()=>{
  //   destroyDroplet()
  // },3000)

  
  return app;

};