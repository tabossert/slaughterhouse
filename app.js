import aws from 'aws-sdk';
import sqsConsumer from 'sqs-consumer';

import Rancher from './util/rancher';

// Configure aws
const apiVersion = '2011-01-01';
const region = process.env.AWS_AUTOSCALING_REGION;
const autoscaling = new aws.AutoScaling({apiVersion, region});

// Configure rancher
const rancherServer = new Rancher({
  hostname: process.env.RANCHER_SERVER_HOSTNAME,
  port: process.env.RANCHER_SERVER_PORT,
  accessKey: process.env.RANCHER_SERVER_ACCESS_KEY,
  secretKey: process.env.RANCHER_SERVER_SECRET_KEY,
});

const handleMessage = (message, done) => {
  console.log('=> SQS Message received');

  // Attempt to parse the message body (the message should be a json string)
  let messageBody = '';
  try {
    messageBody = JSON.parse(message.Body);
    messageBody = JSON.parse(messageBody.Message);
  } catch (error) {
    // Invalid JSON
    console.log('=> Error: Invalid JSON received, can\'t process this message.');
    return done();
  }

  if (messageBody.Event && messageBody.Event === 'autoscaling:TEST_NOTIFICATION') {
    // Test notification, clear the message from the queue.
    console.log('   Message was a test notification, no further processing required.');
    return done();
  } else if (messageBody.Event &&
        messageBody.Event === 'autoscaling:EC2_INSTANCE_TERMINATING' ||
        messageBody.Event === 'autoscaling:EC2_INSTANCE_TERMINATE') {
    // Instance terminating
    console.log('   Received instance terminating notification: ' + messageBody.EC2InstanceId);

    // Setup standard error response
    const errorResponse = (err) => {
      console.log('   Could not remove the host from the rancher server.');
      console.log('   ' + err);
      done();
    };

    // Begin sequence
    // Start by getting the matching hosts from the rancher server
    rancherServer.getHostByIdHostname(messageBody.EC2InstanceId).catch(errorResponse)
    .then((hostIds) => {
      if (hostIds.length > 0) {
        console.log('   Deactivating host: ' + hostIds[0]);

        // Deactivate the host
        rancherServer.deactivateHost(hostIds[0]).catch(errorResponse)
        .then(() => {
          console.log('   Deleting host: ' + hostIds[0]);

          // Delete the host
          rancherServer.deleteHost(hostIds[0]).catch(errorResponse)
          .then(() => {
            console.log('   Host removed from rancher server.');
            console.log('   Resolving lifecycle hook');
          });
        });
      } else {
        // We didn't find a matching host
        errorResponse('Host id not found in rancher server.');
      }
    });
  } else {
    // Anything else
    console.log('   Unknown message type');
    return done();
  }
};

// Setup SQS poll
const consumer = sqsConsumer.create({
  queueUrl: process.env.SQS_URL,
  handleMessage,
});

// Handle errors
consumer.on('error', (err) => {
  console.log('Consumer error, will now exit.');
  console.log(err);
  process.exit(1);
});

// Start receiving messages
consumer.start();
console.log('=> SQS message consumer started, awaiting messages..');
