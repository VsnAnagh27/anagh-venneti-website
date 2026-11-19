---
title: "Derivation of the Tolman–Oppenheimer–Volkoff Equations"
date: 2025-05-20
category: derivations
tags: [GR, neutron stars, stellar structure, TOV]
reading_time: 12
---

## Overview

The Tolman–Oppenheimer–Volkoff (TOV) equations govern the structure of a static, 
spherically symmetric star in general relativity. They are the relativistic 
generalisation of the Newtonian hydrostatic equilibrium equation.

## Setup: The Schwarzschild Metric

For a static, spherically symmetric spacetime, the metric takes the form

$$
ds^2 = -e^{2\Phi(r)}\,dt^2 + e^{2\Lambda(r)}\,dr^2 + r^2\,d\Omega^2
$$

where $\Phi(r)$ and $\Lambda(r)$ are functions to be determined from the 
Einstein field equations.

It is conventional to write $e^{-2\Lambda} = 1 - 2m(r)/r$, where $m(r)$ is the 
enclosed gravitational mass within radius $r$.

## The Stress-Energy Tensor

For a perfect fluid at rest, the stress-energy tensor is

$$
T^{\mu\nu} = (\varepsilon + P)\,u^\mu u^\nu + P\,g^{\mu\nu}
$$

where $\varepsilon$ is the total energy density, $P$ the pressure, 
and $u^\mu = (-e^{-\Phi}, 0, 0, 0)$ is the four-velocity of the fluid at rest.

## Einstein Field Equations

The $(tt)$ and $(rr)$ components of $G_{\mu\nu} = 8\pi T_{\mu\nu}$ give

$$
\frac{dm}{dr} = 4\pi r^2 \varepsilon
$$

$$
\frac{d\Phi}{dr} = \frac{m + 4\pi r^3 P}{r^2\left(1 - \frac{2m}{r}\right)}
$$

## Hydrostatic Equilibrium

The Bianchi identity $\nabla_\mu T^{\mu\nu} = 0$ applied to the $r$-component yields

$$
\frac{dP}{dr} = -(\varepsilon + P)\frac{d\Phi}{dr}
$$

Combining with the metric equation:

$$
\boxed{\frac{dP}{dr} = -\frac{(\varepsilon + P)(m + 4\pi r^3 P)}{r^2\left(1 - \frac{2m}{r}\right)}}
$$

This is the **TOV equation**.

## Boundary Conditions

The system requires:

- $m(0) = 0$ — no enclosed mass at the centre
- $P(0) = P_c$ — central pressure (free parameter, determines the star's mass)
- $P(R) = 0$ — pressure vanishes at the stellar surface $r = R$
- $M = m(R)$ — total gravitational mass

## Tidal Deformability

The tidal Love number $k_2$ and tidal deformability 
$\Lambda = \frac{2}{3}k_2 C^{-5}$ (where $C = M/R$ is the compactness)
are computed from a perturbation equation integrated simultaneously with the TOV system.

```python
def tov_rhs(r, y, eos):
    """RHS of TOV + tidal perturbation equations."""
    P, m, H, beta = y
    eps = eos.energy_density(P)
    
    dPdr   = -(eps + P) * (m + 4*np.pi*r**3*P) / (r**2*(1 - 2*m/r))
    dmdr   = 4*np.pi*r**2*eps
    dHdr   = beta
    dbetadr = tidal_beta_rhs(r, P, eps, m, H, beta)
    
    return [dPdr, dmdr, dHdr, dbetadr]
```

## Notes

The Newtonian limit is recovered when $P \ll \varepsilon$, $m \ll r$, giving
$dP/dr \approx -m\varepsilon/r^2 = -\rho g$, the standard hydrostatic equation.

The TOV equation predicts a **maximum mass** for any given EOS — stars above this 
mass are unstable and collapse to black holes. The observed 2 $M_\odot$ pulsars 
(Demorest et al., Antoniadis et al., Fonseca et al., Cromartie et al.) place 
a powerful lower bound on this maximum.
