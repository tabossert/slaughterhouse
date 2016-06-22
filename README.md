# slaughterhouse
Reaps terminated spot instances from Rancher using SQS messages from ASG

Uses hostname of instances to remove them from Rancher


# Requirements
Hostname reported by rancher agent must match the AWS InstanceID, this can be accomplished by the following

```bash
HOSTNAME=$(curl http://169.254.169.254/latest/meta-data/instance-id)
sudo hostnamectl set-hostname $HOSTNAME
```

#Credits

This is a copy and paste fork of the original handler by Tom Hill tom@greensheep.io as seen here: https://hub.docker.com/r/greensheep/rancher-delete-host

https://github.com/eploko/rancher-asg-host-unregisterer
