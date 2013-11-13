.PHONY: build run all

all: build

package: open-with.xpi

run:
	thunderbird -P dev -no-remote -jsconsole

open-with.xpi:
	zip -r /tmp/open-with-$$$$.xpi * mv /tmp/open-with-$$.xpi $@
