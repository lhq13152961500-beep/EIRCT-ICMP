#!/usr/bin/expect -f

set timeout -1

spawn npx expo start --go --tunnel

expect {
    -re "Proceed anonymously" {
        # Down arrow to select "Proceed anonymously", then Enter
        send "\033\[B\r"
        exp_continue
    }
    -re "Log in\r" {
        send "\033\[B\r"
        exp_continue
    }
    -re "Tunnel ready" {
        exp_continue
    }
    -re "Waiting on" {
        exp_continue
    }
    -re "Bundled" {
        exp_continue
    }
    eof {
        exit 0
    }
}

wait
