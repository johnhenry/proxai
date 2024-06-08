// requires   // app.use(bodyParser.raw({ type: "*/*" }));
//
const bufferToFormData = (body) => {
  const rawData = body.toString().split("\r\n");
  const boundary = rawData.shift();
  const contentStart = "Content-Disposition: form-data; name=";
  let datum = {};
  const data = [];
  for (let i = 0; i < rawData.length; i++) {
    const line = rawData[i];
    if (line.startsWith(contentStart)) {
      datum.name = line.substring(contentStart.length + 1, line.length - 1);
    } else if (line.startsWith(boundary)) {
      data.push(datum);
      datum = {};
    } else {
      datum.value = datum.value || "" + line;
    }
  }
  const formData = new FormData();
  for (const { name, value } of data) {
    formData.append(name, value);
  }
  return formData;
};

const formDataMiddleWare = () => (req, _, next) => {
  try {
    req.formData = bufferToFormData(req.body);
  } finally {
    next();
  }
};
export default formDataMiddleWare;
