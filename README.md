# envoy-xDS

Use typescript to simplify the use of envoy xDS

- [Overview](#Overview)

# Overview

envoy-xDS is a powerful command-line tool built with Deno, designed to simplify
the management of Envoy proxies in non-Kubernetes environments. Instead of
running a continuous control plane server, this project allows you to define
your Envoy configuration in Deno scripts. When executed, these scripts use a
local API to generate Envoy configuration files and strategically place them to
trigger Envoy's hot reloading mechanism.

This approach provides the benefits of dynamic configuration without the
complexity of a persistent gRPC server. It's an ideal solution for single-server
setups, personal projects, or any scenario where you want programmatic control
over Envoy without the overhead of a full-fledged service mesh.

Features Scripted Configuration: Define your Envoy listeners, routes, and
clusters using familiar Deno/TypeScript.

No Service Required: The tool generates static xDS configuration files. No need
to run a continuous gRPC server or manage long-running processes.

Lightweight & Minimalist: Built with Deno, the tool is a single, self-contained
executable with no heavy dependencies.

Hot Reloading: Automatically triggers Envoy to load the new configuration by
writing to a designated file system path, making updates seamless.

No Kubernetes Required: Specifically designed for scenarios where a full-blown
service mesh is overkill, such as personal servers or virtual machines.

How It Works Define Your Configuration: You write a Deno script using the
envoy-xDS API to programmatically define your Envoy configuration.

Generate & Update: You run the Deno script from your terminal. The script's API
calls will generate the necessary Envoy configuration files (e.g.,
listener.yaml, route.yaml, etc.) and save them to a specified directory.

Envoy Hot Reload: Your Envoy proxy is configured to watch this directory. As
soon as the new configuration files appear, Envoy automatically detects the
change and loads the new settings without a restart.
