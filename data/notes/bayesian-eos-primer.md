---
title: "A Bayesian Primer for Equation of State Inference"
date: 2025-05-10
category: bayesian-methods
tags: [Bayesian, MCMC, EOS, inference, tutorial]
reading_time: 18
---

## The Problem

Given a set of neutron star observations $\mathbf{d} = \{d_1, d_2, \ldots\}$ — 
NICER mass-radius measurements, gravitational wave tidal deformabilities, 
radio pulsar masses — what can we infer about the dense matter equation of state?

This is a Bayesian inference problem:

$$
\mathcal{P}(\theta \mid \mathbf{d}) \propto \mathcal{L}(\mathbf{d} \mid \theta)\,\pi(\theta)
$$

where $\theta$ are the EOS parameters, $\mathcal{L}$ is the likelihood, 
and $\pi(\theta)$ is the prior.

## Parameterising the EOS

Rather than using a fully non-parametric EOS, we use a **meta-model**: 
a physically motivated parameterisation anchored to nuclear saturation properties.

The symmetric nuclear matter energy per particle near saturation density 
$n_0 \approx 0.16\,\text{fm}^{-3}$ is expanded as

$$
E(n, \delta) = E_0(n) + E_{\rm sym}(n)\,\delta^2 + \mathcal{O}(\delta^4)
$$

where $\delta = (n_n - n_p)/(n_n + n_p)$ is the isospin asymmetry, and

$$
E_{\rm sym}(n) = J + L\,\chi + \frac{K_{\rm sym}}{2}\chi^2 + \ldots, 
\quad \chi = \frac{n - n_0}{3n_0}
$$

The free parameters are $\{J, L, K_{\rm sym}, \ldots\}$ — the symmetry energy 
and its density derivatives.

## Building the Likelihood

### NICER mass-radius likelihood

NICER provides samples $\{(M_i, R_i)\}$ from the joint mass-radius posterior 
for each observed pulsar. The likelihood for a given EOS $\theta$ is

$$
\mathcal{L}_{\rm NICER}(\theta) = \prod_{\rm pulsars} 
\int \mathcal{P}(M, R)\,\delta\bigl(R - R_{\rm TOV}(M;\theta)\bigr)\,dM\,dR
$$

In practice, this is evaluated by KDE-interpolating the posterior samples 
onto the TOV $M$-$R$ curve.

### Gravitational wave likelihood

From GW170817, LIGO/Virgo provides a posterior on the tidal deformability $\tilde\Lambda$:

$$
\mathcal{L}_{\rm GW}(\theta) \propto \mathcal{P}_{\rm GW}(\tilde\Lambda(\theta))
$$

where $\tilde\Lambda$ is computed from the individual star deformabilities via

$$
\tilde\Lambda = \frac{16}{13}\frac{(m_1 + 12m_2)m_1^4\Lambda_1 + (m_2 + 12m_1)m_2^4\Lambda_2}
{(m_1 + m_2)^5}
$$

## MCMC Sampling

Using `emcee` (Foreman-Mackey et al. 2013):

```python
import emcee
import numpy as np

def log_posterior(theta, data):
    lp = log_prior(theta)
    if not np.isfinite(lp):
        return -np.inf
    ll = log_likelihood(theta, data)
    return lp + ll

# Initialise walkers
ndim, nwalkers = 8, 64
p0 = prior_sample(nwalkers, ndim)

sampler = emcee.EnsembleSampler(nwalkers, ndim, log_posterior, args=[data])
sampler.run_mcmc(p0, nsteps=5000, progress=True)

# Discard burn-in
flat_samples = sampler.get_chain(discard=500, thin=15, flat=True)
```

## Common Pitfalls

> **Prior sensitivity**: EOS posteriors are often prior-dominated in sparse data 
> regimes. Always check sensitivity to prior choice.

- Using non-physical EOS samples (violating causality $c_s \leq c$, 
  stability $dP/d\varepsilon \geq 0$) without filtering.
- Ignoring correlations between different NICER sources (they share 
  systematic uncertainties).
- Underestimating the importance of the $2 M_\odot$ constraint — 
  it alone rules out a large fraction of soft EOS models.

## Further Reading

- Riley et al. (2021), ApJL — NICER PSR J0030 updated analysis  
- Miller et al. (2021), ApJL — NICER PSR J0740  
- Abbott et al. (2018), PhRvL — GW170817 tidal deformability  
- Landry & Essick (2019), PhRvD — non-parametric EOS inference
