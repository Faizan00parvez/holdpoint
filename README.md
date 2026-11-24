# Holdpoint

A local canary-release experiment. A router sends every fifth request to a candidate HTTP service. After each candidate response it chooses whether to keep sampling, route everything back to stable, or promote the candidate.

[Open the interactive rollout replay](https://faizan00parvez.github.io/holdpoint/)

Compare the faulty and healthy runs, or step through the checkpoints to see where traffic went after each decision. The replay uses recorded responses from the local HTTP experiment. After capturing a fresh run, use `node build-demo.mjs` to refresh the offline `holdpoint.html` file and the GitHub Pages copy in `docs/`.

## Run the first experiment

With Node.js 22 or newer, run `node run.mjs`. The script starts three loopback HTTP servers on temporary ports, exercises a faulty release and a healthy control, checks the routing decisions, writes `evidence/run.json`, and closes the servers. Each rerun replaces the local capture.

## The decision

The first 19 candidate responses leave the split in place. At 20 candidate responses, a 5xx rate of 10% or above aborts the rollout. A lower rate promotes it. These illustrative thresholds make the experiment reproducible. They are not a confidence guarantee or a production recommendation.

In the faulty trial, candidate requests 3, 11 and 17 return 503. At candidate request 3 the router holds at 20% traffic. At request 20 it aborts. The next five requests go to stable, including the slot which otherwise would have gone to the candidate. A healthy candidate gets the same workload and is promoted.

## Scope

The traffic is sequential and synthetic. Two versioned HTTP handlers and the proxy run inside one Node process. The proxy actually forwards requests and changes destinations. “Abort” here means routing traffic away from the candidate. This first milestone does not install or roll back a Kubernetes deployment.

Next experiment: run the same release at different arrival rates and measure elapsed time and failed requests before the decision. Argo Rollouts' [analysis and inconclusive outcomes](https://argo-rollouts.readthedocs.io/en/stable/features/analysis/) provide a reference for a later Kubernetes implementation.
