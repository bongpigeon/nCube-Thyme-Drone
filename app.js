/**
 * Copyright (c) 2018, OCEAN
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * 3. The name of the author may not be used to endorse or promote products derived from this software without specific prior written permission.
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * Created by ryeubi on 2015-08-31.
 */

var Onem2mClient = require('./onem2m_client');

var thyme_tas = require('./thyme_tas');

var options = {
    protocol: conf.useprotocol,
    host: conf.cse.host,
    port: conf.cse.port,
    mqttport: conf.cse.mqttport,
    wsport: conf.cse.wsport,
    cseid: conf.cse.id,
    aei: conf.ae.id,
    aeport: conf.ae.port,
    bodytype: conf.ae.bodytype,
    usesecure: conf.usesecure,
};


/* var HTTP_SUBSCRIPTION_ENABLE = 0;
var MQTT_SUBSCRIPTION_ENABLE = 0;
var return_count = 0; */
var request_count = 0;

global.my_control_type = '';
global.my_gcs_name = '';
global.my_parent_cnt_name = '';
global.my_cnt_name = '';
global.pre_my_cnt_name = '';
global.my_mission_parent = '';
global.my_mission_name = '';
global.my_sortie_name = 'disarm';
global.my_gimbal_parent = '';
global.my_gimbal_name = '';
global.my_command_parent_name = '';
global.my_command_name = '';

global.my_drone_type = 'pixhawk';
global.my_secure = 'off';
global.my_system_id = 8;

global.gimbal = {};

global.my_rf_host = '';
global.my_rf_address = '';

global.Req_auth = '';
global.Res_auth = '';
global.Result_auth = '';
global.Certification = '';

const retry_interval = 2500;
const normal_interval = 100;

global.authResult = 'yet';

global.muv_pub_fc_gpi_topic = '';
global.muv_pub_fc_hb_topic = '';
global.muv_pub_fc_attitude_topic = '';
global.muv_pub_fc_bat_state_topic = '';
global.muv_pub_fc_system_time_topic = '';
global.muv_pub_fc_timesync_topic = '';
global.muv_pub_fc_wp_yaw_behavior_topic = '';

global.onem2m_client = new Onem2mClient(options);


function ae_response_action(status, res_body, callback) {
    var aeid = res_body['m2m:ae']['aei'];
    conf.ae.id = aeid;
    callback(status, aeid);
}

function create_cnt_all(count, callback) {
    if (conf.cnt.length == 0) {
        callback(2001, count);
    }
    else {
        if (conf.cnt.hasOwnProperty(count)) {
            var parent = conf.cnt[count].parent;
            var rn = conf.cnt[count].name;
            onem2m_client.create_cnt(parent, rn, count, function (rsc, res_body, count) {
                if (rsc == 5106 || rsc == 2001 || rsc == 4105) {
                    create_cnt_all(++count, function (status, count) {
                        callback(status, count);
                    });
                }
                else {
                    callback(9999, count);
                }
            });
        }
        else {
            callback(2001, count);
        }
    }
}

function delete_sub_all(count, callback) {
    if (conf.sub.length == 0) {
        callback(2001, count);
    }
    else {
        if (conf.sub.hasOwnProperty(count)) {
            var target = conf.sub[count].parent + '/' + conf.sub[count].name;
            onem2m_client.delete_sub(target, count, function (rsc, res_body, count) {
                if (rsc == 5106 || rsc == 2002 || rsc == 2000 || rsc == 4105 || rsc == 4004) {
                    delete_sub_all(++count, function (status, count) {
                        callback(status, count);
                    });
                }
                else {
                    callback(9999, count);
                }
            });
        }
        else {
            callback(2001, count);
        }
    }
}

function create_sub_all(count, callback) {
    if (conf.sub.length == 0) {
        callback(2001, count);
    }
    else {
        if (conf.sub.hasOwnProperty(count)) {
            var parent = conf.sub[count].parent;
            var rn = conf.sub[count].name;
            var nu = conf.sub[count].nu;
            onem2m_client.create_sub(parent, rn, nu, count, function (rsc, res_body, count) {
                if (rsc == 5106 || rsc == 2001 || rsc == 4105) {
                    create_sub_all(++count, function (status, count) {
                        callback(status, count);
                    });
                }
                else {
                    callback('9999', count);
                }
            });
        }
        else {
            callback(2001, count);
        }
    }
}

global.drone_info = {};
global.mission_parent = [];

function retrieve_my_cnt_name(callback) {
    onem2m_client.retrieve_cnt('/Mobius/' + conf.ae.approval_gcs + '/approval/' + conf.ae.name + '/la', 0, function (rsc, res_body, count) {
        if (rsc == 2000) {
            drone_info = res_body[Object.keys(res_body)[0]].con;
            console.log(drone_info);

            if (drone_info.hasOwnProperty('update')) {
                if (drone_info.update === 'enable' || drone_info.update === 'nCube') {
                    const shell = require('shelljs')

                    if (shell.exec('git reset --hard HEAD && git pull').code !== 0) {
                        shell.echo('Error: command failed')
                        shell.exit(1)
                    } else {
                        console.log('Finish update !');
                        drone_info.update = 'disable';
                        sh_adn.crtci('/Mobius/' + conf.ae.approval_gcs + '/approval/' + conf.ae.name, 0, JSON.stringify(drone_info), null, function () {
                            if (drone_info.update === 'disable') {
                                shell.exec('pm2 restart MUV')
                            }
                        });
                    }
                }
            }

            conf.sub = [];
            conf.cnt = [];
            conf.fc = [];

            if (drone_info.hasOwnProperty('gcs')) {
                my_gcs_name = drone_info.gcs;
            } else {
                my_gcs_name = 'nCube_MUV';
            }

            if (drone_info.hasOwnProperty('host')) {
                conf.cse.host = drone_info.host;
            } else {
            }

            console.log("gcs host is " + conf.cse.host);

            var info = {};
            info.parent = '/Mobius/' + drone_info.gcs;
            info.name = 'Drone_Data';
            //console.log("info:", info)
            conf.cnt.push(JSON.parse(JSON.stringify(info)));

            info = {};
            info.parent = '/Mobius/' + drone_info.gcs + '/Drone_Data';
            info.name = drone_info.drone;
            conf.cnt.push(JSON.parse(JSON.stringify(info)));

            info.parent = '/Mobius/' + drone_info.gcs + '/Drone_Data/' + drone_info.drone;
            info.name = my_sortie_name;
            conf.cnt.push(JSON.parse(JSON.stringify(info)));


            my_parent_cnt_name = info.parent;
            my_cnt_name = my_parent_cnt_name + '/' + info.name;

            if (drone_info.hasOwnProperty('mav_ver')) {
                mav_ver = drone_info.mav_ver;
            } else {
                mav_ver = 'v1';
            }

            if (drone_info.hasOwnProperty('type')) {
                my_drone_type = drone_info.type;
            } else {
                my_drone_type = 'ardupilot';
            }

            if (drone_info.hasOwnProperty('secure')) {
                my_secure = drone_info.secure;
            } else {
                my_secure = 'off';
            }

            if (drone_info.hasOwnProperty('system_id')) {
                my_system_id = drone_info.system_id;
            } else {
                my_system_id = 8;
            }

            var info = {};
            info.parent = '/Mobius/' + drone_info.gcs;
            info.name = 'GCS_Data';
            conf.cnt.push(JSON.parse(JSON.stringify(info)));

            info = {};
            info.parent = '/Mobius/' + drone_info.gcs + '/GCS_Data';
            info.name = drone_info.drone;
            conf.cnt.push(JSON.parse(JSON.stringify(info)));

            my_command_parent_name = info.parent;
            my_command_name = my_command_parent_name + '/' + info.name;

            MQTT_SUBSCRIPTION_ENABLE = 1;
            sh_state = 'crtct';
            setTimeout(setup_resources, normal_interval,sh_state);

            callback();
        } else {
            console.log('x-m2m-rsc : ' + rsc + ' <----' + res_body);
            setTimeout(setup_resources, retry_interval, sh_state);
            callback();
        }
    });
}

setTimeout(setup_resources, 100, sh_state);

function setup_resources(_status) {
    sh_state = _status;

    console.log('[status] : ' + _status);

    if (_status === 'rtvct') {
        retrieve_my_cnt_name(function () {
        });
    }
    else if (_status === 'crtae') {
        onem2m_client.create_ae(conf.ae.parent, conf.ae.name, conf.ae.appid, function (status, res_body) {
            console.log(res_body);
            if (status == 2001) {
                ae_response_action(status, res_body, function (status, aeid) {
                    console.log('x-m2m-rsc : ' + status + ' - ' + aeid + ' <----');
                    request_count = 0;

                    setTimeout(setup_resources, 100, 'rtvae');
                });
            }
            else if (status == 5106 || status == 4105) {
                console.log('x-m2m-rsc : ' + status + ' <----');

                setTimeout(setup_resources, 100, 'rtvae');
            }
            else {
                console.log('[???} create container error!  ', status + ' <----');
                // setTimeout(setup_resources, 3000, 'crtae');
            }
        });
    }
    else if (_status === 'rtvae') {
        onem2m_client.retrieve_ae(conf.ae.parent + '/' + conf.ae.name, function (status, res_body) {
            if (status == 2000) {
                var aeid = res_body['m2m:ae']['aei'];
                console.log('x-m2m-rsc : ' + status + ' - ' + aeid + ' <----');

                if (conf.ae.id != aeid && conf.ae.id != ('/' + aeid)) {
                    console.log('AE-ID created is ' + aeid + ' not equal to device AE-ID is ' + conf.ae.id);
                }
                else {
                    request_count = 0;
                    setTimeout(setup_resources, 100, 'crtct');
                }
            }
            else {
                console.log('x-m2m-rsc : ' + status + ' <----');
                // setTimeout(setup_resources, 3000, 'rtvae');
            }
        });
    }
    else if (_status === 'crtct') {
        create_cnt_all(request_count, function (status, count) {
            if (status == 9999) {
                console.log('[???} create container error!');
                // setTimeout(setup_resources, 3000, 'crtct');
            }
            else {
                request_count = ++count;
                if (conf.cnt.length <= count) {
                    request_count = 0;
                    setTimeout(setup_resources, 100, 'delsub');
                }
            }
        });
    }
    else if (_status === 'delsub') {
        delete_sub_all(request_count, function (status, count) {
            if (status == 9999) {
                console.log('[???} create container error!');
                // setTimeout(setup_resources, 3000, 'delsub');
            }
            else {
                request_count = ++count;
                if (conf.sub.length <= count) {
                    request_count = 0;
                    setTimeout(setup_resources, 100, 'crtsub');
                }
            }
        });
    }
    else if (_status === 'crtsub') {
        create_sub_all(request_count, function (status, count) {
            if (status == 9999) {
                console.log('[???} create container error!');
                // setTimeout(setup_resources, 1000, 'crtsub');
            }
            else {
                request_count = ++count;
                if (conf.sub.length <= count) {
                    thyme_tas.ready_for_tas();

                    setTimeout(setup_resources, 100, 'crtci');
                }
            }
        });
    }
    else if (_status === 'crtci') {
    }
}

onem2m_client.on('notification', function (source_uri, cinObj) {

    console.log(source_uri, cinObj);

    var path_arr = source_uri.split('/')
    var event_cnt_name = path_arr[path_arr.length - 2];
    var content = cinObj.con;

    /* ***** USER CODE ***** */
    //if(event_cnt_name === 'led') {
    // send to tas
    //thyme_tas.send_to_tas(event_cnt_name, content);
    //}
    /* */
});
