---
title: "Open Questions on the Hadron-Quark Phase Transition"
date: 2025-04-03
category: open-problems
tags: [phase transition, quark matter, hybrid stars, open problems]
reading_time: 8
---

## Status

This is a living document. Questions marked **[open]** are genuinely unresolved 
to my knowledge. Questions marked **[partial]** have partial answers I am still 
working through.

---

## 1. Is the transition first-order, crossover, or something else? [open]

Lattice QCD shows a crossover at $\mu_B = 0$ and finite temperature. 
At high $\mu_B$ and low $T$ — the neutron star regime — we have no reliable 
lattice results. Perturbative QCD is valid only at asymptotically high densities 
($n \gtrsim 40\,n_0$), far above what neutron stars probe.

**The question**: is there a first-order transition anywhere in the range 
$2\text{–}10\,n_0$, and if so, where and how strong?

**Why it matters**: a strong first-order transition would produce a 
*twin star* branch in the $M$-$R$ diagram — two stable configurations 
at the same mass. This is in principle observable.

---

## 2. What are the GW signatures? [partial]

A phase transition in a merging binary neutron star should leave an imprint 
on the post-merger gravitational wave spectrum — specifically on the dominant 
post-merger oscillation frequency $f_2$.

**Partial answer**: numerical relativity simulations (e.g. Most et al. 2019, 
Prakash et al. 2021) show that a strong phase transition can:
- Shift $f_2$ by $\mathcal{O}(100\,\text{Hz})$
- Produce additional features in the GW spectrum
- Potentially trigger a rapid collapse to a black hole

**What I don't know**: how well current and next-generation detectors 
(ET, CE) can resolve these features given realistic noise and the stochastic 
post-merger signal.

---

## 3. Does the Maxwell construction make physical sense? [open]

The standard Maxwell construction assumes the transition is sharp — 
a discontinuous jump in density at a fixed pressure. But this ignores:
- Surface tension between hadronic and quark phases
- Coulomb screening
- Finite-size effects (pasta phases?)

The **Gibbs construction** allows a mixed phase over a range of pressures, 
but requires global charge neutrality rather than local.

**Open question**: which construction (if any) is physical? Can observations 
distinguish them?

---

## 4. Colour superconductivity [open]

At high densities quark matter is expected to be colour-superconducting 
(CFL, 2SC, ...). This changes:
- The EOS stiffness
- Transport properties (viscosity, conductivity)
- Cooling behaviour

**Problem**: we don't know which colour-SC phase (if any) is realised 
at neutron-star densities, and the model predictions span a wide range.

---

## Speculative direction

One idea I keep coming back to: the *sound speed* $c_s^2 = dP/d\varepsilon$ 
might be the cleanest diagnostic. Perturbative QCD requires $c_s^2 \to 1/3$ 
from below at high density. Current inference results (Annala et al. 2023) 
suggest $c_s^2$ peaks well above $1/3$ at intermediate densities — 
possibly indicating a stiff quark-matter core without a sharp transition.

Whether this is a generic feature or model-dependent is worth exploring systematically.
