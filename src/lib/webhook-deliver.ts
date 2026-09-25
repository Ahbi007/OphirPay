// SPDX-License-Identifier: MIT

import { logger } from "@/lib/logger";
import {
  incDeliveryAttempt,
  incDeliveryFinalOutcome,
  incMetric,
} from "@/lib/metrics-counters";
import { isSafeWebhookUrlAtDelivery } from "@/lib/webhook-url-guard";
import crypto from "crypto";

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
  /** Present and true only for integrator test events — never real payments. */
  test?: boolean;
}

/**
 * Generate HMAC-SHA256 signature for a webhook payload.
 * Receiving endpoints can verify authenticity by recomputing the signature.
 */
export function signWebhookPayload(payload: WebhookPayload, secret: string): string {
  const body = JSON.stringify(payload);
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Build the exact HTTP body that will be transmitted and sign it, so a
 * receiver verifying the HMAC over the received body always matches.
 *
 * Canonicalization: the HMAC is computed over the body with the signature
 * field emptied — `JSON.stringify({...payload, signature: ""})`. A receiver
 * recomputes identically: parse the received body, empty the `signature`
 * field, re-serialize (stable key order), and compare against the
 * `X-OphirPay-Signature` header.
 */
export function buildSignedPayload(
  payload: WebhookPayload,
  secret: string
): { body: string; signature: string } {
  const canonical = JSON.stringify({ ...payload, signature: "" });
  const signature = crypto
    .createHmac("sha256", secret)
    .update(canonical)
    .digest("hex");
  return { body: JSON.stringify({ ...payload, signature }), signature };
}

export interface WebhookRequestPreview {
  canonicalBody: string;
  body: string;
  signature: string;
  headers: Record<string, string>;
}

export function buildWebhookRequestPreview(
  payload: WebhookPayload,
  secret: string
): WebhookRequestPreview {
  const { body, signature } = buildSignedPayload(payload, secret);
  return {
    canonicalBody: JSON.stringify({ ...payload, signature: "" }),
    body,
    signature,
    headers: {
      "Content-Type": "application/json",
      "X-OphirPay-Signature": signature,
      "X-OphirPay-Event": payload.event,
    },
  };
}

export interface WebhookDeliveryResult {
  delivered: boolean;
  status: number | null;
  responseBody: string;
  durationMs: number;
  blocked: boolean;
  error: string | null;
  request: WebhookRequestPreview;
}

export async function deliverWebhookWithDetails(
  url: string,
  secret: string,
  payload: WebhookPayload,
  maxRetries = 3
): Promise<WebhookDeliveryResult> {
  const request = buildWebhookRequestPreview(payload, secret);
  const totalAttempts = Number.isFinite(maxRetries)
    ? Math.max(1, Math.floor(maxRetries))
    : 1;
  const validation = await isSafeWebhookUrlAtDelivery(url);
  if (!validation) {
    const reason = "Webhook target was rejected by the URL guard before any request was made.";
    logger.error("Webhook delivery blocked — URL failed validation", { url, reason });
    incMetric("webhooks_failed_total");
    incDeliveryFinalOutcome("webhook", 1, "failure");
    return {
      delivered: false,
      status: null,
      responseBody: "",
      durationMs: 0,
      blocked: true,
      error: reason,
      request,
    };
  }

  let lastError: string | null = null;
  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    incDeliveryAttempt("webhook", attempt);
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: request.headers,
        body: request.body,
        signal: controller.signal,
        redirect: "manual",
      });
      const responseBody = typeof response.text === "function" ? await response.text() : "";
      const durationMs = Date.now() - startedAt;

      if (response.ok) {
        logger.info("Webhook delivered", { url, event: payload.event, attempt });
        incMetric("webhooks_delivered_total");
        incDeliveryFinalOutcome("webhook", attempt, "success");
        return {
          delivered: true,
          status: response.status,
          responseBody,
          durationMs,
          blocked: false,
          error: null,
          request,
        };
      }

      lastError = `Endpoint returned HTTP ${response.status}.`;
      logger.warn("Webhook delivery failed", { url, status: response.status, attempt });
      if (attempt === totalAttempts) {
        return {
          delivered: false,
          status: response.status,
          responseBody,
          durationMs,
          blocked: false,
          error: lastError,
          request,
        };
      }
    } catch (err) {
      lastError = String(err);
      logger.warn("Webhook delivery error", { url, error: lastError, attempt });
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < totalAttempts) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
    }
  }

  logger.error("Webhook delivery exhausted retries", { url, event: payload.event });
  incMetric("webhooks_failed_total");
  incDeliveryFinalOutcome("webhook", totalAttempts, "failure");
  return {
    delivered: false,
    status: null,
    responseBody: "",
    durationMs: 0,
    blocked: false,
    error: lastError ?? "Webhook delivery failed.",
    request,
  };
}

export async function deliverWebhook(
  url: string,
  secret: string,
  payload: WebhookPayload,
  maxRetries = 3
): Promise<boolean> {
  return (await deliverWebhookWithDetails(url, secret, payload, maxRetries)).delivered;
}
