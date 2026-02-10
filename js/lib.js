import { h, render } from 'preact';
import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import { signal, computed } from '@preact/signals';
import htm from 'htm';

const html = htm.bind(h);

export { html, h, render, useState, useEffect, useRef, useCallback, useMemo, signal, computed };
