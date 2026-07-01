const style = new Proxy({} as Record<string, string>, { get: (_, key) => String(key) });
export default style;
