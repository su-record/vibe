# Code brief: ward shift roster module

## What this is

A roughly 40-line module that builds and looks up the current ward's shift
roster: a list of nurses, each with a name, a start time and an end time.

## Who maintains it, and how often

Two nurses who read Python occasionally, updating the shift list between
schedule changes. Neither writes Python day to day.

## The task

Given a list of shifts, produce each shift's display label and look one up
by nurse name.

## Conventions

- No classes unless state is actually shared across calls; a plain function
  and a list of plain data is preferred over a class with one caller.
- Exceptions propagate to the caller; nothing is caught and silenced.
- No logging in library code — the module returns data, it does not print.
- Constants are module-level names, not entries read out of a config dict,
  unless the value is expected to differ by deployment.

## What "done" looks like

A nurse who opens this file can find the shift lookup and the label
function without tracing through a helper class, and a failed lookup raises
an error naming the nurse's name that was not found.
