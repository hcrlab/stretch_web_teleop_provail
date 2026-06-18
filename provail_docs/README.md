# Stretch Web Interface - Provail

This is a web interface modified from [stretch_web_teleop](https://github.com/hello-robot/stretch_web_teleop) to aid a user study at [Provail](https://provail.org/) with a [Hello-Robot Stretch 3](https://docs.hello-robot.com/0.3/getting_started/hello_robot/).

## Setup in real robot

The Stretch you use should already have its default software installed.

Then, you can make a ROS workspace folder by
```
mkdir -p provail_ws/src
```
changing `provail_ws` to another workspace name if you would like. Then, clone this branch of the repo (which is a ROS package) to `src` with
```
git clone -b test/mock-operator-backend https://github.com/hcrlab/stretch_web_teleop_provail.git
```

Go into the package and install Node dependencies:
```
cd stretch_web_teleop_provail
npm install --legacy-peer-deps
```

Then, go back to the workspace root and build the workspace:
```
cd ../..
colcon build
```

After that, you can go to the package and start the web interface:
```
cd src/stretch_web_teleop_provail
./launch_interface.sh
```

When you are done with the interface, you can close it via
```
./stop_interface.sh
```

## Setup to work with mock backend

This branch features a mock backend, so we can do front-end development without needing a robot. This is the recommended way for you to develop before testing on the robot.

Clone this repo and branch to a folder of your choice:
```
git clone -b test/mock-operator-backend https://github.com/hcrlab/stretch_web_teleop_provail.git
```

Install the Node dependencies:
```
npm install --legacy-peer-deps
```

You can then build and pull up the mock back-end:
```
npm run mock:build
```

Then, in another terminal, pull up the front-end:
```
npm run mock:server
```

This should allow automatic updates when you make changes to the front-end code.
