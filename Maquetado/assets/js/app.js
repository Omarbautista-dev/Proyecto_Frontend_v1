
(function () {
  'use strict';

  var RUTA_USUARIOS = 'mUsuarios.txt';
  var RUTA_PERSONAS = 'mDatosPersonales.txt';
  var RUTA_ACCESOS = 'accesos.txt';
  var RUTA_ROLES = 'roles.txt';
  var CLAVES_SESION = ['nz_usuario', 'nz_nombre', 'nz_rol', 'nz_ingreso', 'nz_id_persona'];

  var colores = { info: '#8BC34A', error: '#C62828' };

  function toast(mensaje, tipo) {
    var anterior = document.querySelector('.toast');
    if (anterior) anterior.remove();

    var caja = document.createElement('div');
    caja.className = 'toast';
    caja.setAttribute('role', 'status');
    caja.style.borderLeftColor = colores[tipo] || colores.info;
    caja.textContent = mensaje;
    document.body.appendChild(caja);

    setTimeout(function () {
      caja.style.transition = 'opacity .25s ease';
      caja.style.opacity = '0';
      setTimeout(function () { caja.remove(); }, 260);
    }, 2800);
  }

  window.nzToast = toast;

  function escapar(texto) {
    return String(texto == null ? '' : texto).replace(/[&<>"']/g, function (caracter) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[caracter];
    });
  }

  function normalizar(valor) {
    var texto = String(valor == null ? '' : valor).trim().toLowerCase();
    if (texto.normalize) {
      texto = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return texto;
  }

  function leerSesion() {
    return {
      usuario: sessionStorage.getItem('nz_usuario') || '',
      nombre: sessionStorage.getItem('nz_nombre') || '',
      rol: sessionStorage.getItem('nz_rol') || '',
      ingreso: sessionStorage.getItem('nz_ingreso') || '',
      idPersona: sessionStorage.getItem('nz_id_persona') || ''
    };
  }

  function cerrarSesion() {
    CLAVES_SESION.forEach(function (clave) {
      sessionStorage.removeItem(clave);
    });
    sessionStorage.removeItem('nz_flash');
  }

  function iniciales(nombre) {
    var partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '??';
    var primera = partes[0].charAt(0);
    var ultima = partes.length > 1 ? partes[partes.length - 1].charAt(0) : '';
    return (primera + ultima).toUpperCase();
  }

  function claveRol(rol) {
    var n = normalizar(rol);

    /* Si roles.txt ya está cargado, la clave es la del rol registrado */
    var registrado = rolDeClaveONombre(rol);
    if (registrado) return registrado.clave;

    if (n.indexOf('gerente') !== -1 || n.indexOf('administrador') !== -1) return 'gerente';
    if (n.indexOf('veterinario') !== -1 || n.indexOf('medico') !== -1) return 'veterinario';
    if (n.indexOf('recinto') !== -1 || n.indexOf('cuidador') !== -1 || n.indexOf('zootecnista') !== -1) return 'recinto';
    if (n.indexOf('mantenimiento') !== -1) return 'mantenimiento';

    return '';
  }

  function paginaActual() {
    /* data-pantalla (en el body) es la fuente explícita de la pantalla que
       se está mostrando; si la página no lo declara, se deriva de la URL. */
    var declarada = document.body && document.body.getAttribute('data-pantalla');
    if (declarada) return declarada;

    var archivo = window.location.pathname.split('/').pop() || 'index.html';
    return archivo.replace(/\.html$/i, '');
  }

  var promesaDatos = null;

  function leerTexto(ruta) {
    return fetch(ruta, { cache: 'no-store' }).then(function (respuesta) {
      if (!respuesta.ok) {
        throw new Error('No se pudo leer ' + ruta + ' (HTTP ' + respuesta.status + ').');
      }
      return respuesta.text();
    });
  }

  function parsearPersonas(texto) {
    return String(texto).split(/\r?\n/).reduce(function (lista, linea, indice) {
      var limpia = linea.trim();

      if (!limpia || limpia.charAt(0) === '#') return lista;

      var partes = limpia.split('|');
      if (partes.length < 2) {
        console.warn('mDatosPersonales.txt: la línea ' + (indice + 1) + ' no tiene el formato id_persona|nombres|apellidos|puesto|correo|telefono.');
        return lista;
      }

      lista.push({
        idPersona: partes[0].trim(),
        nombres: (partes[1] || '').trim(),
        apellidoPaterno: (partes[2] || '').trim(),
        apellidoMaterno: (partes[3] || '').trim(),
        puesto: (partes[4] || '').trim(),
        correo: (partes[5] || '').trim(),
        telefono: (partes[6] || '').trim()
      });

      return lista;
    }, []);
  }

  function parsearUsuarios(texto) {
    return String(texto).split(/\r?\n/).reduce(function (lista, linea, indice) {
      var limpia = linea.trim();

      if (!limpia || limpia.charAt(0) === '#') return lista;

      var partes = limpia.split('|');
      if (partes.length < 4) {
        console.warn('mUsuarios.txt: la línea ' + (indice + 1) + ' no tiene el formato usuario|contrasena|rol|id_persona[|estado|fecIni|fecFin].');
        return lista;
      }

      lista.push({
        usuario: partes[0].trim(),
        contrasena: partes[1].trim(),
        rol: partes[2].trim(),
        idPersona: partes[3].trim(),
        estado: (partes[4] || 'true').trim() || 'true',
        fecIni: (partes[5] || '').trim(),
        fecFin: (partes[6] || '').trim()
      });

      return lista;
    }, []);
  }

  function parsearAccesos(texto) {
    return String(texto).split(/\r?\n/).reduce(function (lista, linea, indice) {
      var limpia = linea.trim();

      if (!limpia || limpia.charAt(0) === '#') return lista;

      var partes = limpia.split('|');
      if (partes.length < 4) {
        console.warn('accesos.txt: la línea ' + (indice + 1) + ' no tiene el formato id_acceso|modulo|operacion|nombre.');
        return lista;
      }

      lista.push({
        id: partes[0].trim(),
        modulo: partes[1].trim(),
        operacion: partes[2].trim(),
        nombre: partes[3].trim()
      });

      return lista;
    }, []);
  }

  function parsearRoles(texto) {
    return String(texto).split(/\r?\n/).reduce(function (lista, linea, indice) {
      var limpia = linea.trim();

      if (!limpia || limpia.charAt(0) === '#') return lista;

      var partes = limpia.split('|');
      if (partes.length < 3) {
        console.warn('roles.txt: la línea ' + (indice + 1) + ' no tiene el formato clave_rol|nombre_rol|descripcion|accesos.');
        return lista;
      }

      lista.push({
        clave: partes[0].trim(),
        nombre: partes[1].trim(),
        descripcion: (partes[2] || '').trim(),
        accesos: (partes[3] || '').split(',').map(function (id) { return id.trim(); }).filter(Boolean)
      });

      return lista;
    }, []);
  }

  /* ------------------------------------------------------------------
   * Roles y accesos (relaciones mRoles y mAccesos)
   * ------------------------------------------------------------------ */
  var MAPA_ACCESOS = null;   /* id_acceso -> { id, modulo, operacion, nombre } */
  var MAPA_ROLES = null;     /* clave_rol -> { clave, nombre, descripcion, accesos } */
  var promesaRoles = null;
  var textoRolesBase = '';

  function parsearRolesBase() {
    return parsearRoles(textoRolesBase);
  }

  function cargarRoles() {
    if (promesaRoles) return promesaRoles;

    promesaRoles = Promise.all([
      leerTexto(RUTA_ACCESOS),
      leerTexto(RUTA_ROLES)
    ]).then(function (resultados) {
      var accesos = parsearAccesos(resultados[0]);
      textoRolesBase = resultados[1];
      var roles = aplicarRespaldoRoles(parsearRoles(textoRolesBase));

      var mapaAccesos = {};
      accesos.forEach(function (acceso) {
        if (!mapaAccesos[acceso.id]) mapaAccesos[acceso.id] = acceso;
      });

      var mapaRoles = {};
      roles.forEach(function (rol) {
        mapaRoles[rol.clave] = rol;
      });

      MAPA_ACCESOS = mapaAccesos;
      MAPA_ROLES = mapaRoles;

      avisarDesfasePermisos(roles);

      return { accesos: accesos, roles: roles };
    }).catch(function (error) {
      promesaRoles = null;
      throw error;
    });

    return promesaRoles;
  }

  function recargarRoles() {
    promesaRoles = null;
    return cargarRoles();
  }

  function rolDeClaveONombre(rol) {
    if (!MAPA_ROLES) return null;

    var buscado = normalizar(rol);
    var encontrada = null;

    Object.keys(MAPA_ROLES).forEach(function (clave) {
      if (encontrada) return;
      var candidato = MAPA_ROLES[clave];

      if (buscado === normalizar(candidato.clave) || buscado === normalizar(candidato.nombre)) {
        encontrada = candidato;
      }
    });

    return encontrada;
  }

  function accesosDeRol(rolKey) {
    var rol = rolDeClaveONombre(rolKey);
    return rol ? (rol.accesos || []).slice() : [];
  }

  function operacionesDeRolEnModulo(rolKey, modulo) {
    var operaciones = {};

    accesosDeRol(rolKey).forEach(function (id) {
      var acceso = MAPA_ACCESOS && MAPA_ACCESOS[id];
      if (!acceso || String(acceso.modulo) !== String(modulo)) return;
      operaciones[acceso.operacion] = true;
    });

    return operaciones;
  }

  /* ------------------------------------------------------------------
   * Reglas de negocio del sistema (validación de cuentas y contraseñas)
   * ------------------------------------------------------------------ */

  function falla(mensaje) {
    return { ok: false, error: mensaje };
  }

  var VALIDACION_OK = { ok: true, error: '' };

  function validarLogin(valor) {
    var texto = String(valor == null ? '' : valor);

    if (texto.length < 11 || texto.length > 16) {
      return falla('Longitud: debe tener de 11 a 16 caracteres (se capturaron ' + texto.length + ').');
    }
    if (!/^[A-Z]/.test(texto)) {
      return falla('Debe comenzar con una letra mayúscula (A-Z), sin incluir Ñ.');
    }
    if (!/^[A-Z][a-z]{2}/.test(texto)) {
      return falla('Debe continuar con 2 letras minúsculas (a-z), sin incluir ñ.');
    }
    if (!/^[A-Z][a-z]{2}\d{2}/.test(texto)) {
      return falla('Debe continuar con 2 dígitos entre el cero y el nueve (0-9).');
    }
    if (!/^[A-Z][a-z]{2}\d{2}[A-Za-z]{3}/.test(texto)) {
      return falla('Debe continuar con 3 letras mayúsculas y/o minúsculas (a-z, A-Z), sin incluir ñ/Ñ.');
    }
    if (!/^[A-Z][a-z]{2}\d{2}[A-Za-z]{3}\d{2}/.test(texto)) {
      return falla('Debe continuar con 2 dígitos entre el cero y el nueve (0-9).');
    }
    if (!/^[A-Za-z0-9+.*$@;%]+$/.test(texto)) {
      return falla('Solo se permiten letras, dígitos y los caracteres especiales: + . * $ @ ; % (sin espacios ni ñ/Ñ).');
    }
    if (!/[+.*$@;%]/.test(texto)) {
      return falla('Debe contener al menos uno de los caracteres especiales: + . * $ @ ; %.');
    }

    return VALIDACION_OK;
  }

  function validarPassword(valor) {
    var texto = String(valor == null ? '' : valor);

    if (texto.length !== 16) {
      return falla('Longitud: debe tener mínima y máxima de 16 caracteres (se capturaron ' + texto.length + ').');
    }
    if (!/^[A-Z]/.test(texto)) {
      return falla('Debe comenzar con una letra mayúscula (A-Z), sin incluir Ñ.');
    }
    if (!/^[A-Z][a-z]{2}/.test(texto)) {
      return falla('Debe continuar con 2 letras minúsculas (a-z), sin incluir ñ.');
    }
    if (!/^[A-Z][a-z]{2}\d{2}/.test(texto)) {
      return falla('Debe continuar con 2 dígitos entre el cero y el nueve (0-9).');
    }
    if (!/^[A-Z][a-z]{2}\d{2}[A-Za-z]{3}/.test(texto)) {
      return falla('Debe continuar con 3 letras mayúsculas y/o minúsculas (a-z, A-Z), sin incluir ñ/Ñ.');
    }
    if (!/^[A-Z][a-z]{2}\d{2}[A-Za-z]{3}\d{2}/.test(texto)) {
      return falla('Debe continuar con 2 dígitos entre el cero y el nueve (0-9).');
    }
    if (!/^[A-Z][a-z]{2}\d{2}[A-Za-z]{3}\d{2}[A-Za-z]{3}/.test(texto)) {
      return falla('Debe continuar con 3 letras mayúsculas y/o minúsculas (a-z, A-Z), sin incluir ñ/Ñ.');
    }
    if (!/^[A-Z][a-z]{2}\d{2}[A-Za-z]{3}\d{2}[A-Za-z]{3}\d{2}/.test(texto)) {
      return falla('Debe continuar con 2 dígitos entre el cero y el nueve (0-9).');
    }
    if (!/^[A-Za-z0-9+.*$@;%]+$/.test(texto)) {
      return falla('Solo se permiten letras, dígitos y los caracteres especiales: + . * $ @ ; % (sin espacios ni ñ/Ñ).');
    }
    if (!/[+.*$@;%]/.test(texto)) {
      return falla('Debe contener al menos uno de los caracteres especiales: + . * $ @ ; %.');
    }

    return VALIDACION_OK;
  }

  /* Regla compartida con el módulo Cambiar de Password: una PassWord no
     puede estar ya registrada en otra cuenta de mUsuarios. */
  function passwordUnico(nueva, loginPropio, usuarios) {
    var duplicado = null;

    usuarios.forEach(function (usuario) {
      if (usuario.usuario === loginPropio) return;
      if (usuario.contrasena === nueva) duplicado = usuario;
    });

    return duplicado;
  }

  function parsearFecha(txt) {
    var coincidencia = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(txt == null ? '' : txt).trim());
    if (!coincidencia) return null;

    var dia = parseInt(coincidencia[1], 10);
    var mes = parseInt(coincidencia[2], 10);
    var anio = parseInt(coincidencia[3], 10);

    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

    /* new Date() rueda las fechas imposibles (31/02/2026 → 03/03/2026):
       se verifica que la fecha construida sea exactamente la capturada. */
    var fecha = new Date(anio, mes - 1, dia);
    if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
      return null;
    }

    return fecha;
  }

  function fechaActualSinHora() {
    var fecha = new Date();
    fecha.setHours(0, 0, 0, 0);
    return fecha;
  }

  function dosDigitos(valor) {
    return valor < 10 ? '0' + valor : String(valor);
  }

  /* dd/mm/aaaa <-> aaaa-mm-dd (los campos type="date" usan el formato ISO) */
  function textoAFechaISO(texto) {
    var fecha = parsearFecha(texto);
    if (!fecha) return '';
    return fecha.getFullYear() + '-' + dosDigitos(fecha.getMonth() + 1) + '-' + dosDigitos(fecha.getDate());
  }

  function fechaISOATexto(iso) {
    var partes = String(iso || '').split('-');
    if (partes.length !== 3) return '';
    return partes[2] + '/' + partes[1] + '/' + partes[0];
  }

  /* nz_ingreso se guarda como ISO (UTC); aquí se convierte a dd/mm/aaaa hh:mm
     en la hora local del equipo para mostrarlo en "Último acceso". */
  function fechaHoraDeSesion(iso) {
    var fecha = new Date(iso);
    if (isNaN(fecha.getTime())) return '—';

    return dosDigitos(fecha.getDate()) + '/' + dosDigitos(fecha.getMonth() + 1) + '/' +
      fecha.getFullYear() + ' ' + dosDigitos(fecha.getHours()) + ':' + dosDigitos(fecha.getMinutes());
  }

  /* Respaldo local de las escrituras (alta, baja y modificación de cuentas de
     usuario y de roles, cambio de PassWord y deshabilitación por caducidad).
     El navegador no puede modificar los .txt, por lo que siguen siendo la
     fuente base y este respaldo se aplica encima de ellos. */
  var CLAVE_RESPALDO = 'nz_usuarios_respaldo';
  var CLAVE_RESPALDO_ROLES = 'nz_roles_respaldo';

  function leerObjetoLocal(clave) {
    try {
      return JSON.parse(localStorage.getItem(clave)) || {};
    } catch (error) {
      console.warn('No se pudo leer el respaldo local (' + clave + ').', error);
      return {};
    }
  }

  function leerRespaldoUsuarios() {
    return leerObjetoLocal(CLAVE_RESPALDO);
  }

  function escribirRespaldoUsuarios(mapa) {
    localStorage.setItem(CLAVE_RESPALDO, JSON.stringify(mapa));
  }

  function leerRespaldoRoles() {
    return leerObjetoLocal(CLAVE_RESPALDO_ROLES);
  }

  function escribirRespaldoRoles(mapa) {
    localStorage.setItem(CLAVE_RESPALDO_ROLES, JSON.stringify(mapa));
  }

  function aplicarRespaldoUsuarios(usuarios) {
    var respaldo = leerRespaldoUsuarios();
    var borrados = respaldo.__borrados || [];
    var nuevos = respaldo.__nuevos || {};
    var lista = [];

    usuarios.forEach(function (usuario) {
      if (borrados.indexOf(usuario.usuario) !== -1) return;

      var cambio = respaldo[usuario.usuario];
      if (cambio) {
        Object.keys(cambio).forEach(function (campo) {
          if (campo.charAt(0) === '_') return;
          usuario[campo] = cambio[campo];
        });
      }

      lista.push(usuario);
    });

    Object.keys(nuevos).forEach(function (login) {
      if (borrados.indexOf(login) !== -1) return;

      var repetido = lista.some(function (usuario) { return usuario.usuario === login; });
      if (!repetido) lista.push(nuevos[login]);
    });

    return lista;
  }

  function guardarCambioUsuario(usuario, cambios) {
    var respaldo = leerRespaldoUsuarios();
    var destino;

    if (respaldo.__nuevos && respaldo.__nuevos[usuario]) {
      destino = respaldo.__nuevos[usuario];
    } else {
      respaldo[usuario] = respaldo[usuario] || {};
      destino = respaldo[usuario];
    }

    Object.keys(cambios).forEach(function (clave) {
      destino[clave] = cambios[clave];
    });

    escribirRespaldoUsuarios(respaldo);
    promesaDatos = null;
  }

  function altaUsuario(datos) {
    var respaldo = leerRespaldoUsuarios();

    respaldo.__nuevos = respaldo.__nuevos || {};
    respaldo.__nuevos[datos.usuario] = datos;
    respaldo.__borrados = (respaldo.__borrados || []).filter(function (login) {
      return login !== datos.usuario;
    });
    delete respaldo[datos.usuario];

    escribirRespaldoUsuarios(respaldo);
    promesaDatos = null;
  }

  function bajaUsuario(login) {
    var respaldo = leerRespaldoUsuarios();

    respaldo.__borrados = respaldo.__borrados || [];
    if (respaldo.__borrados.indexOf(login) === -1) respaldo.__borrados.push(login);

    if (respaldo.__nuevos) delete respaldo.__nuevos[login];
    delete respaldo[login];

    escribirRespaldoUsuarios(respaldo);
    promesaDatos = null;
  }

  function aplicarRespaldoRoles(roles) {
    var respaldo = leerRespaldoRoles();
    var borrados = respaldo.__borrados || [];
    var nuevos = respaldo.__nuevos || {};
    var lista = [];

    roles.forEach(function (rol) {
      if (borrados.indexOf(rol.clave) !== -1) return;

      var cambio = respaldo[rol.clave];
      if (cambio) {
        rol = {
          clave: rol.clave,
          nombre: typeof cambio.nombre === 'string' ? cambio.nombre : rol.nombre,
          descripcion: typeof cambio.descripcion === 'string' ? cambio.descripcion : rol.descripcion,
          accesos: Array.isArray(cambio.accesos) ? cambio.accesos : rol.accesos
        };
      }

      lista.push(rol);
    });

    Object.keys(nuevos).forEach(function (clave) {
      if (borrados.indexOf(clave) !== -1) return;

      var repetido = lista.some(function (rol) { return rol.clave === clave; });
      if (!repetido) lista.push(nuevos[clave]);
    });

    return lista;
  }

  function guardarRol(datos) {
    var respaldo = leerRespaldoRoles();
    var esNuevo = !parsearRolesBase().some(function (rol) { return rol.clave === datos.clave; });

    if (esNuevo) {
      respaldo.__nuevos = respaldo.__nuevos || {};
      respaldo.__nuevos[datos.clave] = datos;
      respaldo.__borrados = (respaldo.__borrados || []).filter(function (clave) {
        return clave !== datos.clave;
      });
      delete respaldo[datos.clave];
    } else {
      respaldo[datos.clave] = datos;
    }

    escribirRespaldoRoles(respaldo);
    promesaRoles = null;
  }

  function borrarRol(clave) {
    var respaldo = leerRespaldoRoles();

    respaldo.__borrados = respaldo.__borrados || [];
    if (respaldo.__borrados.indexOf(clave) === -1) respaldo.__borrados.push(clave);

    if (respaldo.__nuevos) delete respaldo.__nuevos[clave];
    delete respaldo[clave];

    escribirRespaldoRoles(respaldo);
    promesaRoles = null;
  }

  /* Respaldo local de las personas dadas de alta desde la pantalla de cuentas */
  var CLAVE_RESPALDO_PERSONAS = 'nz_personas_respaldo';

  function leerRespaldoPersonas() {
    return leerObjetoLocal(CLAVE_RESPALDO_PERSONAS);
  }

  function aplicarRespaldoPersonas(personas) {
    var respaldo = leerRespaldoPersonas();

    Object.keys(respaldo).forEach(function (idPersona) {
      var repetida = personas.some(function (persona) { return persona.idPersona === idPersona; });
      if (!repetida) personas.push(respaldo[idPersona]);
    });

    return personas;
  }

  function altaPersona(persona) {
    var respaldo = leerRespaldoPersonas();
    respaldo[persona.idPersona] = persona;
    localStorage.setItem(CLAVE_RESPALDO_PERSONAS, JSON.stringify(respaldo));
    promesaDatos = null;
  }

  function siguienteIdPersona(personas) {
    var maximo = 0;

    personas.forEach(function (persona) {
      var coincidencia = /^P(\d+)$/i.exec(String(persona.idPersona || '').trim());
      if (coincidencia) maximo = Math.max(maximo, parseInt(coincidencia[1], 10));
    });

    var nuevo = String(maximo + 1);
    while (nuevo.length < 3) nuevo = '0' + nuevo;
    return 'P' + nuevo;
  }

  function validarVigencia(usuario) {
    var hoy = fechaActualSinHora();
    var fechaIni = parsearFecha(usuario.fecIni);
    var fechaFin = parsearFecha(usuario.fecFin);
    var cuentaActiva = String(usuario.estado).toLowerCase() !== 'false';

    if (fechaIni && hoy < fechaIni) {
      if (!cuentaActiva) {
        return { ok: false, mensaje: 'Cuenta desactivada, póngase en contacto con el administrador' };
      }
      /* Estado true pero la fecha del servidor es inferior a FecIni:
         la cuenta existe, todavía no entra en su vigencia. */
      return { ok: false, mensaje: 'Cuenta pendiente de activar. Contacta al administrador.' };
    }

    if (fechaFin && hoy > fechaFin) {
      if (cuentaActiva) {
        guardarCambioUsuario(usuario.usuario, { estado: 'false' });
        return { ok: false, mensaje: 'Cuenta caducada. Contacta al administrador.' };
      }
      return { ok: false, mensaje: 'Cuenta caducada. Contacta al administrador.' };
    }

    if (!cuentaActiva) {
      return { ok: false, mensaje: 'Cuenta desactivada. Contacta al administrador.' };
    }

    return { ok: true, mensaje: '' };
  }

  /* Intentos fallidos de acceso. Se guardan en localStorage para que
     sobrevivan al cierre de la pestaña, se limpian al iniciar sesión
     correctamente y se descartan solos al vencer la ventana de tiempo. */
  var CLAVE_INTENTOS = 'nz_intentos';
  var MAX_INTENTOS = 5;
  var VENTANA_INTENTOS = 15 * 60 * 1000;   /* 15 minutos */

  function leerIntentos() {
    var origen = leerObjetoLocal(CLAVE_INTENTOS);
    var vigentes = {};
    var ahora = Date.now();

    Object.keys(origen).forEach(function (login) {
      var registro = origen[login];
      if (!registro || typeof registro.desde !== 'number') return;
      if (ahora - registro.desde > VENTANA_INTENTOS) return;
      vigentes[login] = registro;
    });

    return vigentes;
  }

  function escribirIntentos(mapa) {
    /* Sin registros se elimina la clave para no dejar residuos en el navegador */
    if (Object.keys(mapa).length === 0) {
      localStorage.removeItem(CLAVE_INTENTOS);
      return;
    }
    localStorage.setItem(CLAVE_INTENTOS, JSON.stringify(mapa));
  }

  function bloqueoPorIntentos(login) {
    var registro = leerIntentos()[login];
    if (!registro || registro.total < MAX_INTENTOS) return '';

    var restante = Math.max(1, Math.ceil((VENTANA_INTENTOS - (Date.now() - registro.desde)) / 60000));
    return 'Demasiados intentos. Inténtalo de nuevo en ' + restante + ' min.';
  }

  function registrarIntento(login) {
    var mapa = leerIntentos();
    var registro = mapa[login] || { total: 0, desde: Date.now() };

    registro.total += 1;
    mapa[login] = registro;
    escribirIntentos(mapa);

    return registro.total;
  }

  function limpiarIntentos(login) {
    /* leerIntentos() descarta los registros vencidos, así que reescribir el
       mapa limpia de una vez el intento propio y cualquier residuo antiguo */
    var mapa = leerIntentos();
    delete mapa[login];
    escribirIntentos(mapa);
  }

  function nombreCompletoDe(persona) {
    if (!persona) return '';

    return [
      persona.nombres,
      persona.apellidoPaterno,
      persona.apellidoMaterno
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  function cargarDatos() {
    if (!promesaDatos) {
      promesaDatos = Promise.all([
        leerTexto(RUTA_USUARIOS),
        leerTexto(RUTA_PERSONAS)
      ]).then(function (resultados) {
        var usuarios = parsearUsuarios(resultados[0]);
        var personas = aplicarRespaldoPersonas(parsearPersonas(resultados[1]));
        var mapaPersonas = {};

        usuarios = aplicarRespaldoUsuarios(usuarios);

        personas.forEach(function (persona) {
          if (!persona.idPersona) return;

          if (mapaPersonas[persona.idPersona]) {
            console.warn('mDatosPersonales.txt: el id_persona "' + persona.idPersona + '" está duplicado; se conserva el primer registro.');
            return;
          }

          mapaPersonas[persona.idPersona] = persona;
        });

        usuarios.forEach(function (usuario) {
          if (!mapaPersonas[usuario.idPersona]) {
            console.warn('mUsuarios.txt: el usuario "' + usuario.usuario + '" referencia el id_persona "' + usuario.idPersona + '" que no existe en mDatosPersonales.txt.');
          }
        });

        return {
          usuarios: usuarios,
          personas: personas,
          mapaPersonas: mapaPersonas
        };
      }).catch(function (error) {
        promesaDatos = null;
        throw error;
      });
    }

    return promesaDatos;
  }

  function iconoAccion(tipo) {
    if (tipo === 'modificar') {
      return '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">' +
        '<path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>' +
        '</svg>';
    }

    return '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>' +
      '</svg>';
  }

  function renderizarTablaUsuarios(cuerpo, datos, sesion) {
    if (!cuerpo) return;

    cuerpo.innerHTML = '';

    datos.usuarios.forEach(function (usuario) {
      var persona = datos.mapaPersonas[usuario.idPersona];
      var nombre = persona ? nombreCompletoDe(persona) : '';
      var fila = document.createElement('tr');

      var celdaNombre = document.createElement('td');
      if (nombre) {
        celdaNombre.textContent = nombre;
      } else {
        var aviso = document.createElement('span');
        aviso.className = 'tag rojo';
        aviso.textContent = 'Sin persona asociada';
        celdaNombre.appendChild(aviso);
      }
      fila.appendChild(celdaNombre);

      var celdaLogin = document.createElement('td');
      celdaLogin.className = 'mono';
      celdaLogin.textContent = usuario.usuario;
      fila.appendChild(celdaLogin);

      var celdaIni = document.createElement('td');
      celdaIni.textContent = usuario.fecIni || '—';
      fila.appendChild(celdaIni);

      var celdaFin = document.createElement('td');
      celdaFin.textContent = usuario.fecFin || '—';
      fila.appendChild(celdaFin);

      var celdaEstado = document.createElement('td');
      var cuentaActiva = String(usuario.estado).toLowerCase() !== 'false';
      celdaEstado.innerHTML = '<span class="tag ' + (cuentaActiva ? 'verde' : 'rojo') + '">' +
        (cuentaActiva ? 'ACTIVO' : 'INACTIVO') + '</span>';
      if (usuario.fecIni || usuario.fecFin) {
        celdaEstado.title = 'Vigencia: ' + (usuario.fecIni || '—') + ' al ' + (usuario.fecFin || '—');
      }
      fila.appendChild(celdaEstado);

      var celdaModificar = document.createElement('td');
      celdaModificar.className = 'acc';
      var botonModificar = document.createElement('button');
      botonModificar.type = 'button';
      botonModificar.className = 'icono-tabla';
      botonModificar.setAttribute('data-accion', 'modificar');
      botonModificar.setAttribute('data-login', usuario.usuario);
      botonModificar.setAttribute('title', 'Modificar la cuenta de ' + usuario.usuario);
      botonModificar.setAttribute('aria-label', 'Modificar la cuenta de ' + usuario.usuario);
      botonModificar.innerHTML = iconoAccion('modificar');
      celdaModificar.appendChild(botonModificar);
      fila.appendChild(celdaModificar);

      var celdaBorrar = document.createElement('td');
      celdaBorrar.className = 'acc';
      var botonBorrar = document.createElement('button');
      botonBorrar.type = 'button';
      botonBorrar.className = 'icono-tabla peligro';
      botonBorrar.setAttribute('data-accion', 'borrar');
      botonBorrar.setAttribute('data-login', usuario.usuario);
      botonBorrar.setAttribute('title', 'Dar de baja la cuenta de ' + usuario.usuario);
      botonBorrar.setAttribute('aria-label', 'Dar de baja la cuenta de ' + usuario.usuario);
      botonBorrar.innerHTML = iconoAccion('borrar');
      celdaBorrar.appendChild(botonBorrar);
      fila.appendChild(celdaBorrar);

      fila.setAttribute('data-login', usuario.usuario);
      if (sesion && sesion.usuario === usuario.usuario) fila.setAttribute('data-propia', '1');

      cuerpo.appendChild(fila);
    });
  }

  var MENU = [
    { id: 'inicio', etiqueta: 'Inicio / Panel', ruta: 'inicio.html', modulo: '0' },
    {
      id: 'seguridad', etiqueta: '1. Seguridad', modulo: '1',
      submenu: [
        { etiqueta: '1.1 Creación de roles y permisos', ruta: 'roles-accesos.html', titulo: '1.1 Creación de roles y permisos' },
        { etiqueta: '1.2 Asignación de roles', ruta: 'seguridad-roles.html', titulo: '1.2 Asignación de roles a usuarios' },
        { etiqueta: '1.3 Usuarios', ruta: 'seguridad-usuarios.html#usuarios', titulo: '1.3 Control de usuarios y permisos' },
        { etiqueta: '1.4 Bitácora de accesos', ruta: 'seguridad-usuarios.html#bitacora', titulo: '1.4 Bitácora de accesos' },
        { etiqueta: '1.5 Aplicaciones del sistema', ruta: 'seguridad-aplicaciones.html', titulo: '1.5 Aplicaciones del sistema' }
      ]
    },
    {
      id: 'catalogo', etiqueta: '2. Catálogo zoológico', modulo: '2',
      submenu: [
        { etiqueta: '2.1 Especies', ruta: 'catalogo-censo.html#especies', titulo: '2.1 Especies registradas' },
        { etiqueta: '2.2 Animales', ruta: 'catalogo-censo.html#animales', titulo: '2.2 Animales y fichas individuales' },
        { etiqueta: '2.3 Recintos', ruta: 'catalogo-censo.html#recintos', titulo: '2.3 Recintos del parque' },
        { etiqueta: '2.4 Censo faunístico', ruta: 'catalogo-censo.html' },
        { etiqueta: '2.5 Mantenimiento de catálogos', ruta: 'catalogo-mantenimiento.html', titulo: '2.5 Mantenimiento de catálogos' }
      ]
    },
    {
      id: 'nutricion', etiqueta: '3. Nutrición', modulo: '3',
      submenu: [
        { etiqueta: '3.1 Categorías de alimento', ruta: 'nutricion-dietas-nueva.html#categorias', titulo: '3.1 Categorías de alimento' },
        { etiqueta: '3.2 Alimentos', ruta: 'nutricion-dietas-nueva.html#alimentos', titulo: '3.2 Alimentos y porciones' },
        {
          etiqueta: '3.3 Dietas',
          ruta: 'nutricion-dietas.html',
          /* Sólo el Gerente tiene Alta/Baja/Modificación en el módulo 3; los
             demás perfiles tienen sólo Consulta y van al listado de solo lectura. */
          rutaPorRol: { gerente: 'nutricion-dietas-nueva.html' }
        },
        { etiqueta: '3.4 Detalle de dieta', ruta: 'nutricion-dietas.html#detalle', titulo: '3.4 Detalle de la dieta' },
        { etiqueta: '3.5 Horarios', ruta: 'nutricion-dietas.html#horarios', titulo: '3.5 Horarios de alimentación' }
      ]
    },
    {
      id: 'operacion', etiqueta: '4. Operación diaria', modulo: '4',
      submenu: [
        { etiqueta: '4.1 Registro de alimentación', ruta: 'operacion-registro.html' },
        { etiqueta: '4.2 Historial por animal', ruta: 'reportes-oficiales.html#alimentacion', titulo: '4.2 Historial de alimentación por animal' },
        { etiqueta: '4.3 Pendientes del día', ruta: 'inicio.html#pendientes', titulo: '4.3 Pendientes del día' },
        { etiqueta: '4.4 Mis animales asignados', ruta: 'recinto-mis-animales.html' },
        { etiqueta: '4.5 Bitácora de limpieza', ruta: 'recinto-bitacora.html' },
        { etiqueta: '4.6 Incidencias y alertas', ruta: 'recinto-incidencias.html' },
        { etiqueta: '4.7 Supervisión de alimentación', ruta: 'operacion-supervision.html' }
      ]
    },
    {
      id: 'inventario', etiqueta: '5. Inventario y compras', modulo: '5',
      submenu: [
        { etiqueta: '5.1 Existencias', ruta: 'inventario-existencias.html' },
        {
          etiqueta: '5.2 Movimientos (salidas)',
          ruta: 'inventario-compras.html#salidas',
          titulo: '5.2 Movimientos y salidas de inventario',
          tituloPorRol: { recinto: '5.2 Retiro de insumos' },
          rutaPorRol: { recinto: 'recinto-retiro.html' }
        },
        { etiqueta: '5.3 Proveedores', ruta: 'inventario-existencias.html#proveedores', titulo: '5.3 Proveedores registrados' },
        { etiqueta: '5.4 Solicitudes de compra', ruta: 'inventario-compras.html' }
      ]
    },
    {
      id: 'reportes', etiqueta: '6. Reportes', modulo: '6',
      submenu: [
        { etiqueta: '6.1 Centro de reportes', ruta: 'reportes-oficiales.html#consumo', titulo: '6.1 Centro de reportes' },
        { etiqueta: '6.2 Alimentación y dietas', ruta: 'reportes-oficiales.html#alimentacion', titulo: '6.2 Alimentación y dietas' },
        { etiqueta: '6.3 Inventario y mermas', ruta: 'reportes-oficiales.html#inventario', titulo: '6.3 Inventario y mermas' },
        { etiqueta: '6.4 Reportes oficiales', ruta: 'reportes-oficiales.html#oficiales', titulo: '6.4 Reportes oficiales' }
      ]
    },
    {
      id: 'configuracion', etiqueta: '7. Configuración', modulo: '7',
      submenu: [
        { etiqueta: '7.1 Parámetros generales', ruta: 'configuracion.html#parametros', titulo: '7.1 Parámetros generales' },
        { etiqueta: '7.2 Respaldo de base de datos', ruta: 'configuracion.html#respaldo', titulo: '7.2 Respaldo de base de datos' }
      ]
    },
    {
      id: 'clinica', etiqueta: '8. Clínica veterinaria', modulo: '8',
      submenu: [
        { etiqueta: '8.1 Expediente clínico', ruta: 'clinico-expediente.html' },
        { etiqueta: '8.2 Historial de salud', ruta: 'clinico-expediente.html#historial', titulo: '8.2 Historial de salud' },
        { etiqueta: '8.3 Cuarentena y observación', ruta: 'clinico-expediente.html#cuarentena', titulo: '8.3 Cuarentena y observación' },
        { etiqueta: '8.4 Medicamentos y recetas', ruta: 'clinico-recetas.html' }
      ]
    },
    {
      id: 'personal', etiqueta: '9. Personal y turnos', modulo: '9',
      submenu: [
        { etiqueta: '9.1 Asignación de personal', ruta: 'personal-turnos.html' },
        { etiqueta: '9.2 Horario general', ruta: 'personal-turnos.html#horario', titulo: '9.2 Horario general de turnos' },
        { etiqueta: '9.3 Encargados y tareas por recinto', ruta: 'gerente-tareas-recintos.html', titulo: '9.3 Encargados y tareas por recinto', soloRol: 'gerente' }
      ]
    },
    {
      id: 'mantenimiento', etiqueta: '10. Mantenimiento', modulo: '10',
      submenu: [
        { etiqueta: '10.1 Solicitudes y averías', ruta: 'mantenimiento-solicitudes.html' },
        { etiqueta: '10.2 Mantenimiento preventivo', ruta: 'mantenimiento-calendario.html' },
        { etiqueta: '10.3 Reparaciones y materiales', ruta: 'mantenimiento-reparaciones.html' }
      ]
    },
    /* Sin módulo: disponible para todos los perfiles, igual que Cambiar de
       Password. "Mi perfil" vivía dentro del módulo 1 y por eso sólo el
       Gerente podía verlo. */
    { id: 'mi-perfil', etiqueta: 'Mi perfil', ruta: 'mi-perfil.html' },
    { id: 'cambiar-clave', etiqueta: 'Cambiar de Password', ruta: 'cambiar-password.html' },
    { id: 'salir', etiqueta: 'Cerrar Sesión', accion: 'salir' }
  ];

  var PERMISOS = {
    '0': { gerente: 'full', veterinario: 'full', recinto: 'full', mantenimiento: 'full' },
    '1': { gerente: 'full' },
    '2': { gerente: 'full', veterinario: 'consulta', recinto: 'consulta' },
    '3': { gerente: 'full', veterinario: 'consulta', recinto: 'consulta' },
    '4': { gerente: 'consulta', veterinario: 'full', recinto: 'full' },
    '5': { gerente: 'full', veterinario: 'consulta', recinto: 'consulta', mantenimiento: 'consulta' },
    '6': { gerente: 'full', veterinario: 'full', recinto: 'consulta' },
    '7': { gerente: 'full' },
    '8': { gerente: 'consulta', veterinario: 'full', recinto: 'consulta' },
    '9': { gerente: 'full', veterinario: 'consulta', recinto: 'consulta', mantenimiento: 'consulta' },
    '10': { gerente: 'full', recinto: 'consulta', mantenimiento: 'full' }
  };

  function permisoDe(modulo, rolKey) {
    /* El panel de control siempre se muestra tras un acceso válido */
    if (!modulo || String(modulo) === '0') return 'full';

    /* Los accesos del rol vienen de roles.txt / accesos.txt */
    if (MAPA_ROLES && MAPA_ROLES[rolKey]) {
      var operaciones = operacionesDeRolEnModulo(rolKey, modulo);

      if (operaciones['Alta'] || operaciones['Baja'] || operaciones['Modificación']) return 'full';
      if (operaciones['Consulta']) return 'consulta';
      return '';
    }

    /* Si los archivos de roles no se pudieron leer se usan los permisos base */
    var permisos = PERMISOS[String(modulo)] || {};
    return permisos[rolKey] || '';
  }

  /* PERMISOS es sólo el respaldo de lectura de roles.txt / accesos.txt. Si
     las dos fuentes dejan de coincidir se avisa en consola, para que no
     convivan silenciosamente dos versiones distintas de los permisos. */
  function avisarDesfasePermisos(roles) {
    if (!MAPA_ROLES) return;

    /* Se comparan las dos direcciones: lo que PERMISOS declara debe existir
       en roles.txt y lo que roles.txt otorga debe estar declarado en PERMISOS. */
    var modulos = {};
    Object.keys(PERMISOS).forEach(function (modulo) { modulos[modulo] = true; });
    roles.forEach(function (rol) {
      Object.keys(MAPA_ACCESOS || {}).forEach(function (id) {
        var acceso = MAPA_ACCESOS[id];
        modulos[String(acceso.modulo)] = true;
      });
      modulos[String(0)] = true;   /* el módulo 0 se otorga completo siempre */
    });

    roles.forEach(function (rol) {
      Object.keys(modulos).forEach(function (modulo) {
        var operaciones = operacionesDeRolEnModulo(rol.clave, modulo);
        var obtenido = '';

        if (operaciones['Alta'] || operaciones['Baja'] || operaciones['Modificación']) obtenido = 'full';
        else if (operaciones['Consulta']) obtenido = 'consulta';

        if (String(modulo) === '0') return;

        var esperado = (PERMISOS[modulo] && PERMISOS[modulo][rol.clave]) || '';

        if (obtenido !== esperado) {
          console.warn('Permisos fuera de sincronía: módulo ' + modulo + ' del rol "' + rol.clave +
            '" = "' + (esperado || '(sin entrada)') + '" en PERMISOS y "' + (obtenido || '(sin acceso)') +
            '" en roles.txt.');
        }
      });
    });
  }

  function rutaDeSubmenu(sub, rolKey) {
    if (sub.rutaPorRol && sub.rutaPorRol[rolKey]) return sub.rutaPorRol[rolKey];
    return sub.ruta || '#';
  }

  function marcarEnlaceActivo(enlace) {
    enlace.classList.add('act');
    enlace.setAttribute('aria-current', 'page');

    var submenu = enlace.closest('.submenu');
    if (!submenu) return;

    submenu.classList.add('abierto');
    var boton = document.querySelector('[aria-controls="' + submenu.id + '"]');
    if (boton) {
      boton.classList.add('act');
      boton.setAttribute('aria-expanded', 'true');
    }
  }

  function seccionesDeVentana() {
    return Array.prototype.slice.call(document.querySelectorAll('[data-ventana]'));
  }

  function ventanaActual() {
    var secciones = seccionesDeVentana();
    if (!secciones.length) return '';

    var hash = (window.location.hash || '').replace(/^#/, '');
    var i;

    if (hash) {
      for (i = 0; i < secciones.length; i += 1) {
        if (secciones[i].getAttribute('data-ventana') === hash) return hash;
      }
    }

    for (i = 0; i < secciones.length; i += 1) {
      if (secciones[i].hasAttribute('data-ventana-defecto')) {
        return secciones[i].getAttribute('data-ventana');
      }
    }

    for (i = 0; i < secciones.length; i += 1) {
      if (!secciones[i].getAttribute('data-ventana')) return '';
    }

    return secciones[0].getAttribute('data-ventana');
  }

  function aplicarVentana() {
    var secciones = seccionesDeVentana();
    if (secciones.length < 2) return;

    var actual = ventanaActual();
    var i;

    for (i = 0; i < secciones.length; i += 1) {
      secciones[i].hidden = secciones[i].getAttribute('data-ventana') !== actual;
    }

    if ((window.location.hash || '').replace(/^#/, '')) {
      window.scrollTo(0, 0);
    }
  }

  function actualizarTitulo(enlace) {
    var titulo = document.querySelector('.topbar .tit h1');
    if (!titulo) return;

    if (!titulo.hasAttribute('data-titulo-pagina')) {
      titulo.setAttribute('data-titulo-pagina', titulo.textContent);
    }

    var texto = enlace ? enlace.getAttribute('data-titulo') : '';
    titulo.textContent = texto || titulo.getAttribute('data-titulo-pagina');
  }

  function resaltarActual(rolKey) {
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    var actual = paginaActual();
    var hash = (window.location.hash || '').replace(/^#/, '');
    var ventana = ventanaActual();
    var enlaces = sidebar.querySelectorAll('a.item[href]');
    var candidatos = [];
    var i;

    enlaces.forEach(function (enlace) {
      enlace.classList.remove('act');
      enlace.removeAttribute('aria-current');

      var href = enlace.getAttribute('href');
      if (!href || href === '#') return;

      var partes = href.split('#');
      var base = partes[0].replace(/\.html$/i, '');
      var ancla = partes[1] || '';

      if (base === actual || (actual === 'gerente-dashboard' && base === 'inicio')) {
        candidatos.push({ enlace: enlace, ancla: ancla });
      }
    });

    sidebar.querySelectorAll('.menu .grupo').forEach(function (boton) {
      boton.classList.remove('act');
      boton.setAttribute('aria-expanded', 'false');
    });

    sidebar.querySelectorAll('.submenu').forEach(function (submenu) {
      submenu.classList.remove('abierto');
    });

    var elegido = null;

    if (hash) {
      for (i = 0; i < candidatos.length; i += 1) {
        if (candidatos[i].ancla === hash) {
          elegido = candidatos[i];
          break;
        }
      }
    }

    if (!elegido) {
      for (i = 0; i < candidatos.length; i += 1) {
        if (candidatos[i].ancla === ventana) {
          elegido = candidatos[i];
          break;
        }
      }
    }

    if (!elegido && candidatos.length) elegido = candidatos[0];
    if (elegido) marcarEnlaceActivo(elegido.enlace);
    actualizarTitulo(elegido ? elegido.enlace : null);
  }

  function construirSidebar(rolKey) {
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    var sesion = leerSesion();
    var html = '';

    html += '<div class="logo">Nutri<span>Zoo</span><small>LT · Administración nutricional</small></div>';
    html += '<nav aria-label="Menú principal"><ul class="menu">';

    MENU.forEach(function (item) {
      var permiso = permisoDe(item.modulo, rolKey);
      if (!permiso) return;

      if (item.submenu) {
        var idSubmenu = 'sub-' + item.id;
        html += '<li>';
        html += '<button type="button" class="item grupo" aria-expanded="false" aria-controls="' + idSubmenu + '">';
        html += '<span class="etiqueta-menu">' + escapar(item.etiqueta);
        if (permiso === 'consulta') {
          html += ' <span class="acceso-parcial" title="Solo consulta" aria-label="Solo consulta">◐</span>';
        }
        html += '</span><span class="caret" aria-hidden="true">▶</span></button>';
        html += '<ul class="submenu" id="' + idSubmenu + '">';

        item.submenu.forEach(function (sub) {
          if (sub.soloRol && sub.soloRol !== rolKey) return;
          if (sub.bloqueado) {
            html += '<li><a class="item sub bloqueado" href="#" data-bloqueado>' + escapar(sub.etiqueta) + '</a></li>';
          } else {
            var tituloSub = sub.titulo || sub.tituloPorRol ? ' data-titulo="' + escapar((sub.tituloPorRol && sub.tituloPorRol[rolKey]) || sub.titulo || '') + '"' : '';
            html += '<li><a class="item sub" href="' + escapar(rutaDeSubmenu(sub, rolKey)) + '"' + tituloSub + '>' + escapar(sub.etiqueta) + '</a></li>';
          }
        });

        html += '</ul></li>';
      } else if (item.accion === 'salir') {
        html += '<li><a class="item" href="#" data-cerrar-sesion>';
        html += '<span class="etiqueta-menu">' + escapar(item.etiqueta) + '</span></a></li>';
      } else {
        html += '<li><a class="item" href="' + escapar(item.ruta) + '">';
        html += '<span class="etiqueta-menu">' + escapar(item.etiqueta);
        if (permiso === 'consulta') {
          html += ' <span class="acceso-parcial" title="Solo consulta" aria-label="Solo consulta">◐</span>';
        }
        html += '</span></a></li>';
      }
    });

    html += '</ul></nav>';
    html += '<div class="pie">';
    html += '<strong>Sesión iniciada</strong><br>';
    html += '<span id="pie-usuario">' + escapar(sesion.nombre || sesion.usuario) + '</span><br>';
    html += '<span id="pie-rol">' + escapar(sesion.rol) + '</span>';
    html += '</div>';

    sidebar.innerHTML = html;

    aplicarVentana();
    resaltarActual(rolKey);

    window.addEventListener('hashchange', function () {
      aplicarVentana();
      resaltarActual(rolKey);
    });

    sidebar.querySelectorAll('.menu .grupo').forEach(function (boton) {
      boton.addEventListener('click', function () {
        var submenu = document.getElementById(boton.getAttribute('aria-controls'));
        if (!submenu) return;

        var abierto = boton.getAttribute('aria-expanded') === 'true';
        boton.setAttribute('aria-expanded', String(!abierto));
        submenu.classList.toggle('abierto', !abierto);
      });
    });
  }

  var sidebar = document.querySelector('.sidebar');
  var botonMenu = document.querySelector('.hamburguesa');
  var velo = document.querySelector('.velo');

  function cerrarMenu() {
    if (!sidebar) return;
    sidebar.classList.remove('abierto');
    if (velo) velo.classList.remove('visible');
    if (botonMenu) botonMenu.setAttribute('aria-expanded', 'false');
  }

  if (botonMenu && sidebar) {
    botonMenu.addEventListener('click', function () {
      var abierto = sidebar.classList.toggle('abierto');
      if (velo) velo.classList.toggle('visible', abierto);
      botonMenu.setAttribute('aria-expanded', String(abierto));
    });
  }

  if (velo) velo.addEventListener('click', cerrarMenu);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') cerrarMenu();
  });

  document.addEventListener('click', function (e) {
    var bloqueado = e.target.closest('[data-bloqueado]');
    if (bloqueado) {
      e.preventDefault();
      toast('No tienes permiso para abrir esa pantalla.');
      cerrarMenu();
      return;
    }

    var salirMenu = e.target.closest('[data-cerrar-sesion]');
    if (salirMenu) {
      e.preventDefault();
      cerrarSesion();
      window.location.replace('login.html');
      return;
    }

    var boton = e.target.closest('.contenido .btn, .contenido .btn2, .contenido .btn-rojo, .contenido .btnrojo, .contenido .btn-gris, .contenido .btn-contorno, .contenido .btn-opcion');
    if (boton && boton.tagName !== 'A' && !boton.hasAttribute('data-real')) {
      e.preventDefault();
      toast('Acción no disponible.');
    }
  });

  var formLogin = document.getElementById('form-login');

  if (formLogin) {
    var campoUsuario = document.getElementById('usuario');
    var campoContrasena = document.getElementById('contrasena');
    var botonLogin = document.getElementById('btn-login');
    var cajaError = document.getElementById('login-error');
    var verClave = document.getElementById('ver-clave');
    var enviando = false;
    var temporizadorError = null;

    function mostrarError(mensaje) {
      if (!cajaError) {
        return;
      }

      cajaError.innerHTML = '';

      var principal = document.createElement('strong');
      principal.textContent = mensaje;
      cajaError.appendChild(principal);

      [campoUsuario, campoContrasena].forEach(function (campo) {
        if (!campo) return;
        campo.classList.add('login-input-error');
        campo.setAttribute('aria-invalid', 'true');
      });

      cajaError.hidden = false;
      if (temporizadorError) window.clearTimeout(temporizadorError);
      temporizadorError = window.setTimeout(function () { limpiarError(true); }, 5000);
    }

    function limpiarError(limpiarCampos) {
      if (temporizadorError) window.clearTimeout(temporizadorError);
      temporizadorError = null;
      if (cajaError) {
        cajaError.innerHTML = '';
        cajaError.hidden = true;
      }
      [campoUsuario, campoContrasena].forEach(function (campo) {
        if (!campo) return;
        campo.classList.remove('login-input-error');
        campo.setAttribute('aria-invalid', 'false');
        if (limpiarCampos) campo.value = '';
      });
    }

    if (verClave && campoContrasena) {
      verClave.addEventListener('click', function () {
        var visible = campoContrasena.type === 'text';
        campoContrasena.type = visible ? 'password' : 'text';
        verClave.textContent = visible ? 'Ver' : 'Ocultar';
        verClave.setAttribute('aria-pressed', String(!visible));
        verClave.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
        campoContrasena.focus();
      });
    }

    formLogin.addEventListener('submit', function (e) {
      e.preventDefault();

      if (enviando) return;
      limpiarError();

      var usuarioEscrito = campoUsuario.value.trim();
      var contrasenaEscrita = campoContrasena.value;

      if (!usuarioEscrito || !contrasenaEscrita) {
        mostrarError('Completa usuario y contraseña.');
        return;
      }

      /* 1. Bloqueo temporal por intentos fallidos (se revisa antes que nada) */
      var bloqueo = bloqueoPorIntentos(usuarioEscrito);
      if (bloqueo) {
        mostrarError(bloqueo);
        return;
      }

      /* 2. Reglas de formato del login y de la contraseña. */
      var reglaLogin = validarLogin(usuarioEscrito);
      var reglaPassword = validarPassword(contrasenaEscrita);

      if (!reglaLogin.ok || !reglaPassword.ok) {
        mostrarError('Formato incorrecto en usuario o contraseña.');
        campoContrasena.focus();
        return;
      }

      enviando = true;
      if (botonLogin) {
        botonLogin.disabled = true;
        botonLogin.textContent = 'VALIDANDO…';
      }

      cargarDatos().then(function (datos) {
        var encontrado = null;
        var i;

        /* 3. El login debe existir previamente registrado, tal y como se escribió */
        for (i = 0; i < datos.usuarios.length; i += 1) {
          if (datos.usuarios[i].usuario === usuarioEscrito) {
            encontrado = datos.usuarios[i];
            break;
          }
        }

        /* 4. El PassWord debe estar previamente registrado en algún registro de mUsuarios */
        var passwordRegistrado = false;
        for (i = 0; i < datos.usuarios.length; i += 1) {
          if (datos.usuarios[i].contrasena === contrasenaEscrita) {
            passwordRegistrado = true;
            break;
          }
        }

        /* 5. Si falta algún dato válido, mostrar un mensaje general. Solo contar
              intentos cuando el login existe para limitar contraseñas incorrectas. */
        if (!encontrado || !passwordRegistrado) {
          if (encontrado) registrarIntento(usuarioEscrito);

          mostrarError('Usuario o contraseña incorrectos.');
          campoContrasena.focus();
          return;
        }

        /* 6. Ambos existen: el PassWord debe coincidir exactamente con el registrado */
        if (encontrado.contrasena !== contrasenaEscrita) {
          registrarIntento(usuarioEscrito);
          mostrarError('Usuario o contraseña incorrectos.');
          campoContrasena.focus();
          return;
        }

        limpiarIntentos(usuarioEscrito);

        /* 7. Estado de la cuenta y vigencia (FecIni / FecFin) */
        var vigencia = validarVigencia(encontrado);
        if (!vigencia.ok) {
          mostrarError(vigencia.mensaje);
          campoContrasena.focus();
          return;
        }

        var persona = datos.mapaPersonas[encontrado.idPersona];

        if (!persona) {
          mostrarError('No se encontró el perfil asociado a esta cuenta.');
          campoContrasena.focus();
          return;
        }

        var nombreReal = nombreCompletoDe(persona) || encontrado.usuario;

        sessionStorage.setItem('nz_usuario', encontrado.usuario);
        sessionStorage.setItem('nz_nombre', nombreReal);
        sessionStorage.setItem('nz_rol', encontrado.rol);
        sessionStorage.setItem('nz_id_persona', encontrado.idPersona);
        sessionStorage.setItem('nz_ingreso', new Date().toISOString());

        /* 8. Acceso válido: se muestra el menú principal y el dashboard */
        window.location.href = 'inicio.html';
      }).catch(function (error) {
        console.error(error);
        mostrarError('No se pudo validar el acceso. Inténtalo de nuevo.');
      }).then(function () {
        enviando = false;
        if (botonLogin) {
          botonLogin.disabled = false;
          botonLogin.textContent = 'ACEPTAR';
        }
      });
    });
  }

  var zonaPrivada = document.querySelector('[data-requiere-sesion]');

  function iniciarZonaPrivada() {
    var sesion = leerSesion();

    if (!sesion.usuario || !sesion.rol) {
      window.location.replace('login.html');
      return;
    }

    var rolKey = claveRol(sesion.rol);
    var modulo = document.body.getAttribute('data-modulo');
    var soloRol = document.body.getAttribute('data-solo-rol');

    function redirigirSinAcceso() {
      sessionStorage.setItem('nz_flash', 'No tienes acceso a esa pantalla con el perfil actual.');
      window.location.replace('inicio.html');
    }

    /* Sin rol reconocido no se bloquea el acceso: se muestra el menú con las
       opciones disponibles por defecto (Inicio, Cambiar de Password y Cerrar
       Sesión) y los módulos sin permiso quedan ocultos. */
    if (soloRol && soloRol !== rolKey) {
      redirigirSinAcceso();
      return;
    }

    if (modulo && !permisoDe(modulo, rolKey)) {
      redirigirSinAcceso();
      return;
    }

    construirSidebar(rolKey);

    var nombre = sesion.nombre || sesion.usuario;
    var elNombre = document.getElementById('usuario-nombre');
    var elRol = document.getElementById('usuario-rol');
    var elAvatar = document.getElementById('usuario-iniciales');

    if (elNombre) elNombre.textContent = nombre;
    if (elRol) elRol.textContent = sesion.rol;
    if (elAvatar) elAvatar.textContent = iniciales(nombre);

    /* El bloque del usuario en la barra superior abre "Mi perfil": hasta ahora
       el topbar no tenía ninguna ruta al perfil y éste vivía sólo en el
       módulo 1 (sólo visible para el Gerente). */
    var cajaUsuario = document.querySelector('.topbar .usuario .datos');
    if (cajaUsuario) {
      cajaUsuario.setAttribute('data-perfil', '');
      cajaUsuario.setAttribute('role', 'link');
      cajaUsuario.setAttribute('tabindex', '0');
      cajaUsuario.setAttribute('title', 'Ver mi perfil');

      var abrirPerfil = function () { window.location.href = 'mi-perfil.html'; };

      cajaUsuario.addEventListener('click', abrirPerfil);
      cajaUsuario.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          abrirPerfil();
        }
      });
    }

    var perfilNombre = document.getElementById('perfil-nombre');
    if (perfilNombre) {
      cargarDatos().then(function (datos) {
        var persona = datos.mapaPersonas[sesion.idPersona];
        var valores = {
          'perfil-nombre': sesion.nombre || sesion.usuario,
          'perfil-usuario': sesion.usuario,
          'perfil-rol': sesion.rol,
          'perfil-id': sesion.idPersona || '—',
          'perfil-puesto': (persona && persona.puesto) || '—',
          'perfil-correo': (persona && persona.correo) || '—',
          'perfil-telefono': (persona && persona.telefono) || '—',
          'perfil-ultimo-acceso': fechaHoraDeSesion(sesion.ingreso)
        };

        Object.keys(valores).forEach(function (id) {
          var campo = document.getElementById(id);
          if (!campo) return;
          if (campo.tagName === 'INPUT') campo.value = valores[id];
          else campo.textContent = valores[id];
        });
      }).catch(function (error) {
        console.error(error);
      });
    }

    document.querySelectorAll('[data-roles]').forEach(function (elemento) {
      var permitidos = elemento.getAttribute('data-roles').split(',').map(function (valor) {
        return valor.trim();
      });

      if (permitidos.indexOf(rolKey) === -1) {
        elemento.hidden = true;
      }
    });

    var salir = document.getElementById('cerrar-sesion');
    if (salir) {
      salir.addEventListener('click', function (e) {
        e.preventDefault();
        cerrarSesion();
        window.location.replace('login.html');
      });
    }

    var flash = sessionStorage.getItem('nz_flash');
    if (flash) {
      sessionStorage.removeItem('nz_flash');
      setTimeout(function () {
        toast(flash, 'error');
      }, 350);
    }
  }

  if (zonaPrivada) {
    /* Los roles y sus accesos se leen antes de construir el menú lateral y de
       validar el acceso a la pantalla; si los archivos no estuvieran disponibles
       se continúa con los permisos base del sistema. */
    cargarRoles().catch(function (error) {
      console.warn('No se pudieron leer roles.txt y accesos.txt; se usan los permisos base.', error);
    }).then(function () {
      iniciarZonaPrivada();
    });
  }

  /* ------------------------------------------------------------------
   * Módulo: Cambiar de Password (solo la cuenta de la sesión actual)
   * ------------------------------------------------------------------ */
  function initCambioPassword() {
    var form = document.getElementById('form-cambiar-clave');
    if (!form) return;

    var campoAnterior = document.getElementById('clave-actual');
    var campoNueva = document.getElementById('clave-nueva');
    var campoRepetir = document.getElementById('clave-repetir');
    var botonAceptar = document.getElementById('btn-aceptar-clave');
    var botonCancelar = document.getElementById('btn-cancelar-clave');
    var cajaMsg = document.getElementById('cambio-msg');

    if (!campoAnterior || !campoNueva || !campoRepetir || !botonAceptar || !botonCancelar) return;

    function mostrarMsg(texto, tipo) {
      if (!cajaMsg) {
        toast(texto, tipo === 'ok' ? 'info' : 'error');
        return;
      }
      cajaMsg.className = 'msj ' + (tipo || '');
      cajaMsg.textContent = texto;
      cajaMsg.hidden = false;
    }

    function ocultarMsg() {
      if (!cajaMsg) return;
      cajaMsg.textContent = '';
      cajaMsg.hidden = true;
    }

    /* Errores por área de captura (mensaje general + detalle por campo) */
    var CAMPOS_ERROR = {
      anterior: 'err-clave-actual',
      nueva: 'err-clave-nueva',
      repetir: 'err-clave-repetir'
    };

    function mostrarCampoError(campo, mensajes) {
      var caja = document.getElementById(CAMPOS_ERROR[campo]);
      if (!caja) return;

      if (!mensajes || !mensajes.length) {
        caja.textContent = '';
        caja.hidden = true;
        return;
      }

      caja.textContent = mensajes.join('  ·  ');
      caja.hidden = false;
    }

    function limpiarErroresCampo() {
      Object.keys(CAMPOS_ERROR).forEach(function (campo) {
        mostrarCampoError(campo, null);
      });
    }

    function actualizarBoton() {
      var completo = campoAnterior.value.trim() !== '' &&
        campoNueva.value.trim() !== '' &&
        campoRepetir.value.trim() !== '';

      /* El botón Aceptar permanece inactivo sin la información de las tres áreas */
      botonAceptar.disabled = !completo;
    }

    Array.prototype.forEach.call(form.querySelectorAll('.ver-clave'), function (boton) {
      var input = document.getElementById(boton.getAttribute('data-campo'));
      if (!input) return;

      boton.addEventListener('click', function () {
        var visible = input.type === 'text';
        input.type = visible ? 'password' : 'text';
        boton.textContent = visible ? 'Ver' : 'Ocultar';
        boton.setAttribute('aria-pressed', String(!visible));
        boton.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
        input.focus();
      });
    });

    [campoAnterior, campoNueva, campoRepetir].forEach(function (campo, indice) {
      var llaveCampo = ['anterior', 'nueva', 'repetir'][indice];

      campo.addEventListener('input', function () {
        ocultarMsg();
        mostrarCampoError(llaveCampo, null);
        actualizarBoton();
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var sesion = leerSesion();
      if (!sesion.usuario) {
        window.location.replace('login.html');
        return;
      }

      var anterior = campoAnterior.value;
      var nueva = campoNueva.value;
      var repetir = campoRepetir.value;

      if (!anterior || !nueva || !repetir) {
        mostrarMsg('El botón Aceptar permanece inactivo: se requiere información en las tres áreas de captura (PassWord Anterior, PassWord Nuevo y Repetir PassWord Nuevo).', 'av');
        return;
      }

      cargarDatos().then(function (datos) {
        var actual = null;

        /* Los datos se usan únicamente para la cuenta de la sesión actual */
        datos.usuarios.forEach(function (usuario) {
          if (usuario.usuario === sesion.usuario) actual = usuario;
        });

        if (!actual) {
          mostrarMsg('La cuenta "' + sesion.usuario + '" ya no existe en la relación mUsuarios. Contacta al administrador.', 'er');
          return;
        }

        /* Validación de los tres datos según las reglas de formato:
           se revisan en conjunto y se muestra el detalle de cada área. */
        var errsAnterior = [];
        var errsNueva = [];
        var errsRepetir = [];
        var regla;

        /* PassWord Anterior: formato válido y coincidente con el registrado */
        regla = validarPassword(anterior);
        if (!regla.ok) {
          errsAnterior.push('Formato inválido: ' + regla.error);
        } else if (actual.contrasena !== anterior) {
          errsAnterior.push('Dato inconsistente');
        }

        /* PassWord Nuevo: formato válido, distinto al actual y único en mUsuarios */
        regla = validarPassword(nueva);
        if (!regla.ok) {
          errsNueva.push('Formato inválido: ' + regla.error);
        }
        if (nueva === actual.contrasena) {
          errsNueva.push('Dato inconsistente con el password anterior');
        }
        if (nueva === anterior) {
          errsNueva.push('Dato igual al password anterior');
        }

        if (!errsNueva.length) {
          var duplicado = passwordUnico(nueva, actual.usuario, datos.usuarios);

          if (duplicado) {
            errsNueva.push('Dato inconsistente: el PassWord ya está registrado en mUsuarios (login "' + duplicado.usuario + '")');
          }
        }

        /* Repetir PassWord Nuevo: debe coincidir con el PassWord Nuevo */
        regla = validarPassword(repetir);
        if (repetir !== nueva) {
          errsRepetir.push('Dato inconsistente con el password nuevo');
        }
        if (!regla.ok) {
          errsRepetir.push('Formato inválido: ' + regla.error);
        }
        if (!errsRepetir.length && actual.contrasena === repetir) {
          errsRepetir.push('Dato inconsistente con el password anterior');
        }

        mostrarCampoError('anterior', errsAnterior);
        mostrarCampoError('nueva', errsNueva);
        mostrarCampoError('repetir', errsRepetir);

        if (errsAnterior.length || errsNueva.length || errsRepetir.length) {
          mostrarMsg('Cambio de Password Inconcluso, póngase en contacto con el administrador o reinténtelo', 'er');
          toast('Cambio de Password inconcluso: revisa los detalles indicados.', 'error');
          return;
        }

        /* Aceptar: se actualiza únicamente el registro del usuario en sesión */
        guardarCambioUsuario(actual.usuario, { contrasena: nueva });

        mostrarMsg('Cambio de Password concluido', 'ok');
        toast('Cambio de Password concluido.');

        form.reset();
        limpiarErroresCampo();
        actualizarBoton();
        campoAnterior.focus();
      }).catch(function (error) {
        console.error(error);
        mostrarMsg('No se pudo leer mUsuarios.txt. Abre el proyecto con un servidor local (Live Server o "python -m http.server") e inténtalo de nuevo.', 'er');
      });
    });

    botonCancelar.addEventListener('click', function () {
      /* Cancelar: limpia las tres áreas de captura como recién accedido al módulo */
      form.reset();
      ocultarMsg();
      limpiarErroresCampo();
      actualizarBoton();
      campoAnterior.focus();
      toast('Operación cancelada: las tres áreas de captura quedaron vacías.');
    });

    actualizarBoton();
  }

  initCambioPassword();

  /* ------------------------------------------------------------------
   * Módulo: cuentas de usuario (NAME USER, LOGIN, PASSWORD, vigencia)
   * ------------------------------------------------------------------ */
  function initCuentaUsuario() {
    var campoPersona = document.getElementById('cuenta-persona');
    var campoLogin = document.getElementById('cuenta-login');
    var campoPassword = document.getElementById('cuenta-password');
    var campoIni = document.getElementById('cuenta-fini');
    var campoFin = document.getElementById('cuenta-ffin');
    var campoEstado = document.getElementById('cuenta-estado');
    var cajaError = document.getElementById('cuenta-error');
    var botonNuevo = document.getElementById('cuenta-nuevo');
    var botonActualizar = document.getElementById('cuenta-actualizar');
    var botonCancelar = document.getElementById('cuenta-cancelar');
    var botonSalir = document.getElementById('cuenta-salir');
    var botonVer = document.getElementById('cuenta-ver');
    var botonAltaPersona = document.getElementById('cuenta-alta-persona');
    var panelAltaPersona = document.getElementById('persona-alta');
    var cuerpo = document.getElementById('cuerpo-usuarios');

    if (!campoPersona || !campoLogin || !cuerpo) return;

    var sesion = leerSesion();
    var modo = 'consulta';     /* consulta | nuevo | edicion */
    var loginEdicion = '';

    function mostrarError(texto) {
      if (!cajaError) {
        if (texto) toast(texto, 'error');
        return;
      }

      if (!texto) {
        cajaError.textContent = '';
        cajaError.hidden = true;
        return;
      }

      cajaError.textContent = texto;
      cajaError.hidden = false;
    }

    function pintarPersonas(datos) {
      var seleccion = campoPersona.value;

      campoPersona.innerHTML = '';
      var vacia = document.createElement('option');
      vacia.value = '';
      vacia.textContent = 'Seleccione el nombre de la persona';
      campoPersona.appendChild(vacia);

      datos.personas.slice().sort(function (a, b) {
        return nombreCompletoDe(a).localeCompare(nombreCompletoDe(b));
      }).forEach(function (persona) {
        var opcion = document.createElement('option');
        opcion.value = persona.idPersona;
        opcion.textContent = nombreCompletoDe(persona);
        campoPersona.appendChild(opcion);
      });

      campoPersona.value = seleccion || '';
    }

    function pintarTabla(datos) {
      renderizarTablaUsuarios(cuerpo, datos, sesion);
    }

    function recargar() {
      return cargarDatos().then(function (datos) {
        pintarPersonas(datos);
        pintarTabla(datos);
        return datos;
      }).catch(function (error) {
        console.error(error);
        mostrarError('No se pudieron cargar los datos de usuarios. Verifica que el proyecto esté servido por un servidor local.');
      });
    }

    /* En modo consulta los campos de captura quedan bloqueados (mismo
       patrón que Roles y accesos y Aplicaciones del sistema): sólo el
       botón NUEVO / GUARDAR entra en captura. El selector de persona se
       deja habilitado porque es el arranque natural de una captura nueva. */
    function bloquearCampos(bloquear) {
      campoLogin.readOnly = bloquear;
      campoPassword.readOnly = bloquear;
      campoIni.disabled = bloquear;
      campoFin.disabled = bloquear;
      if (campoEstado) campoEstado.disabled = bloquear;
    }

    function limpiarFormulario() {
      campoPersona.value = '';
      campoLogin.value = '';
      campoPassword.value = '';
      campoIni.value = '';
      campoFin.value = '';
      campoEstado.checked = true;
      loginEdicion = '';
      mostrarError('');
    }

    function iniciarNuevo() {
      modo = 'nuevo';

      /* Se conserva la persona ya elegida: limpiar no debe deshacer el
         primer gesto del usuario (bug: borraba lo recién capturado). */
      var personaElegida = campoPersona.value;
      limpiarFormulario();
      if (personaElegida) campoPersona.value = personaElegida;

      bloquearCampos(false);
      if (botonNuevo) botonNuevo.textContent = 'GUARDAR';

      if (personaElegida) campoLogin.focus();
      else campoPersona.focus();
    }

    function volverConsulta() {
      modo = 'consulta';
      limpiarFormulario();
      bloquearCampos(true);
      if (botonNuevo) botonNuevo.textContent = 'NUEVO / GUARDAR';
    }

    function leerFormulario() {
      return {
        idPersona: campoPersona.value,
        usuario: campoLogin.value.trim(),
        contrasena: campoPassword.value,
        fecIni: fechaISOATexto(campoIni.value),
        fecFin: fechaISOATexto(campoFin.value),
        estado: campoEstado.checked ? 'true' : 'false'
      };
    }

    function validarFormulario(datos, esNuevo, usuarios) {
      if (!datos.idPersona) return 'NAME USER: selecciona el nombre de la persona.';
      if (!datos.usuario) return 'LOGIN: captura el login de la cuenta.';

      var reglaLogin = validarLogin(datos.usuario);
      if (!reglaLogin.ok) return 'LOGIN: ' + reglaLogin.error;

      var repetido = usuarios.some(function (usuario) {
        return usuario.usuario === datos.usuario && usuario.usuario !== loginEdicion;
      });
      if (repetido) return 'LOGIN: ya existe una cuenta registrada con ese login.';

      if (esNuevo && !datos.contrasena) return 'PASSWORD: captura el password de la cuenta.';

      if (datos.contrasena) {
        var reglaPassword = validarPassword(datos.contrasena);
        if (!reglaPassword.ok) return 'PASSWORD: ' + reglaPassword.error;

        /* Misma regla que el módulo Cambiar de Password */
        var duplicado = passwordUnico(datos.contrasena, esNuevo ? '' : loginEdicion, usuarios);
        if (duplicado) {
          return 'PASSWORD: ya está registrado en mUsuarios (login "' + duplicado.usuario + '").';
        }

        if (!esNuevo && loginEdicion) {
          var cuentaActual = null;
          usuarios.forEach(function (usuario) {
            if (usuario.usuario === loginEdicion) cuentaActual = usuario;
          });
          if (cuentaActual && cuentaActual.contrasena === datos.contrasena) {
            return 'PASSWORD: el PassWord Nuevo debe ser distinto al PassWord actual.';
          }
        }
      }

      if (datos.fecIni && datos.fecFin) {
        var fechaIni = parsearFecha(datos.fecIni);
        var fechaFin = parsearFecha(datos.fecFin);
        if (fechaIni && fechaFin && fechaFin < fechaIni) {
          return 'FECHA DE TÉRMINO: debe ser posterior a la fecha de inicio.';
        }
      }

      /* Igual que en BORRA: no se puede dejar fuera de servicio la cuenta
         con la que se inició sesión (auto-bloqueo). */
      if (!esNuevo && loginEdicion === sesion.usuario) {
        if (datos.estado === 'false') {
          return 'EDO. DE LA CUENTA: no puedes desactivar la cuenta con la que iniciaste sesión.';
        }

        if (datos.fecFin) {
          var hoy = fechaActualSinHora();
          var vence = parsearFecha(datos.fecFin);
          if (vence && hoy > vence) {
            return 'FECHA DE TÉRMINO: no puedes dejar vencida la cuenta con la que iniciaste sesión.';
          }
        }
      }

      return '';
    }

    function confirmar(texto) {
      return window.confirm(texto);
    }

    function guardarNuevo() {
      cargarDatos().then(function (datos) {
        var nuevos = leerFormulario();
        var error = validarFormulario(nuevos, true, datos.usuarios);
        if (error) {
          mostrarError(error);
          toast(error, 'error');
          return;
        }

        altaUsuario({
          usuario: nuevos.usuario,
          contrasena: nuevos.contrasena,
          rol: 'Sin rol asignado',
          idPersona: nuevos.idPersona,
          estado: nuevos.estado,
          fecIni: nuevos.fecIni,
          fecFin: nuevos.fecFin
        });

        volverConsulta();
        toast('Cuenta "' + nuevos.usuario + '" dada de alta.');
        recargar();
      }).catch(function (error) {
        console.error(error);
        mostrarError('No se pudieron cargar los datos de usuarios.');
      });
    }

    function actualizarCuenta() {
      if (modo !== 'edicion' || !loginEdicion) {
        mostrarError('Selecciona la cuenta a modificar con el botón MODIF de la tabla.');
        toast('Selecciona la cuenta a modificar con el botón MODIF de la tabla.', 'error');
        return;
      }

      cargarDatos().then(function (datos) {
        var cambios = leerFormulario();
        var error = validarFormulario(cambios, false, datos.usuarios);
        if (error) {
          mostrarError(error);
          toast(error, 'error');
          return;
        }

        var cambiosGuardar = {
          idPersona: cambios.idPersona,
          estado: cambios.estado,
          fecIni: cambios.fecIni,
          fecFin: cambios.fecFin
        };
        if (cambios.contrasena) cambiosGuardar.contrasena = cambios.contrasena;

        guardarCambioUsuario(loginEdicion, cambiosGuardar);
        volverConsulta();
        toast('Cuenta "' + loginEdicion + '" actualizada.');
        recargar();
      }).catch(function (error) {
        console.error(error);
        mostrarError('No se pudieron cargar los datos de usuarios.');
      });
    }

    function cargarParaModificar(login) {
      cargarDatos().then(function (datos) {
        var usuario = null;
        datos.usuarios.forEach(function (candidato) {
          if (candidato.usuario === login) usuario = candidato;
        });

        if (!usuario) {
          mostrarError('La cuenta "' + login + '" ya no existe.');
          return;
        }

        modo = 'edicion';
        loginEdicion = login;
        mostrarError('');
        bloquearCampos(false);
        campoPersona.value = usuario.idPersona || '';
        campoLogin.value = usuario.usuario;
        campoLogin.readOnly = true;
        campoPassword.value = '';
        campoIni.value = textoAFechaISO(usuario.fecIni);
        campoFin.value = textoAFechaISO(usuario.fecFin);
        campoEstado.checked = String(usuario.estado).toLowerCase() !== 'false';
        if (botonNuevo) botonNuevo.textContent = 'NUEVO / GUARDAR';
        campoPassword.focus();

        if (cajaError) cajaError.scrollIntoView({ block: 'nearest' });
      }).catch(function (error) {
        console.error(error);
        mostrarError('No se pudieron cargar los datos de usuarios.');
      });
    }

    function darDeBaja(login) {
      if (login === sesion.usuario) {
        mostrarError('No puedes dar de baja la cuenta con la que iniciaste sesión.');
        toast('No puedes dar de baja la cuenta con la que iniciaste sesión.', 'error');
        return;
      }

      if (!confirmar('¿Dar de baja la cuenta "' + login + '"? Dejará de poder iniciar sesión.')) return;

      bajaUsuario(login);
      if (loginEdicion === login) volverConsulta();
      toast('Cuenta "' + login + '" dada de baja.');
      recargar();
    }

    if (botonNuevo) {
      botonNuevo.addEventListener('click', function () {
        if (modo === 'nuevo') guardarNuevo();
        else iniciarNuevo();
      });
    }

    if (botonActualizar) {
      botonActualizar.addEventListener('click', actualizarCuenta);
    }

    if (botonCancelar) {
      botonCancelar.addEventListener('click', function () {
        volverConsulta();
        toast('Captura cancelada.');
      });
    }

    if (botonSalir) {
      botonSalir.addEventListener('click', function () {
        window.location.href = 'inicio.html';
      });
    }

    if (botonVer && campoPassword) {
      botonVer.addEventListener('click', function () {
        var visible = campoPassword.type === 'text';
        campoPassword.type = visible ? 'password' : 'text';
        botonVer.textContent = visible ? 'Ver' : 'Ocultar';
        botonVer.setAttribute('aria-pressed', String(!visible));
        botonVer.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
        campoPassword.focus();
      });
    }

    /* Los campos de captura sólo se usan cuando ya se entró en modo nuevo
       o edición (están bloqueados en consulta), así que aquí sólo se limpia
       el mensaje de error. */
    [campoLogin, campoPassword, campoIni, campoFin].forEach(function (campo) {
      if (!campo) return;
      campo.addEventListener('input', function () { mostrarError(''); });
      campo.addEventListener('change', function () { mostrarError(''); });
    });

    /* El selector de persona sí está habilitado en consulta: al elegir una
       persona se entra en captura conservando la selección. */
    if (campoPersona) {
      campoPersona.addEventListener('change', function () {
        mostrarError('');
        if (modo === 'consulta') iniciarNuevo();
      });
    }

    if (campoEstado) {
      campoEstado.addEventListener('change', function () {
        mostrarError('');
      });
    }

    cuerpo.addEventListener('click', function (e) {
      var boton = e.target.closest ? e.target.closest('button[data-accion]') : null;
      if (!boton) return;

      var login = boton.getAttribute('data-login');
      if (boton.getAttribute('data-accion') === 'modificar') cargarParaModificar(login);
      else darDeBaja(login);
    });

    /* Alta de personas desde el propio módulo (botón +) */
    if (botonAltaPersona && panelAltaPersona) {
      var campoNombres = document.getElementById('persona-nombres');
      var campoApellidos = document.getElementById('persona-apellidos');
      var campoPuesto = document.getElementById('persona-puesto');
      var campoCorreo = document.getElementById('persona-correo');
      var campoTelefono = document.getElementById('persona-telefono');
      var botonAgregar = document.getElementById('persona-agregar');
      var botonCancelarPersona = document.getElementById('persona-cancelar');

      botonAltaPersona.addEventListener('click', function () {
        panelAltaPersona.hidden = !panelAltaPersona.hidden;
        if (!panelAltaPersona.hidden && campoNombres) campoNombres.focus();
      });

      if (botonCancelarPersona) {
        botonCancelarPersona.addEventListener('click', function () {
          panelAltaPersona.hidden = true;
        });
      }

      if (botonAgregar) {
        botonAgregar.addEventListener('click', function () {
          var nombres = campoNombres ? campoNombres.value.trim() : '';
          var apellidos = campoApellidos ? campoApellidos.value.trim() : '';

          if (!nombres || !apellidos) {
            toast('Captura los nombres y los apellidos de la persona.', 'error');
            if (campoNombres) campoNombres.focus();
            return;
          }

          cargarDatos().then(function (datos) {
            var persona = {
              idPersona: siguienteIdPersona(datos.personas),
              nombres: nombres,
              apellidoPaterno: apellidos,
              apellidoMaterno: '',
              puesto: campoPuesto ? campoPuesto.value.trim() : '',
              correo: campoCorreo ? campoCorreo.value.trim() : '',
              telefono: campoTelefono ? campoTelefono.value.trim() : ''
            };

            altaPersona(persona);

            if (campoNombres) campoNombres.value = '';
            if (campoApellidos) campoApellidos.value = '';
            if (campoPuesto) campoPuesto.value = '';
            if (campoCorreo) campoCorreo.value = '';
            if (campoTelefono) campoTelefono.value = '';
            panelAltaPersona.hidden = true;

            toast('Persona agregada: ' + nombreCompletoDe(persona) + '.');
            return recargar().then(function () {
              campoPersona.value = persona.idPersona;
              if (modo === 'consulta') iniciarNuevo();
              campoPersona.value = persona.idPersona;
            });
          }).catch(function (error) {
            console.error(error);
            toast('No se pudo agregar la persona.', 'error');
          });
        });
      }
    }

    bloquearCampos(true);
    recargar();
  }

  initCuentaUsuario();

  /* ------------------------------------------------------------------
   * Módulo: roles, usuarios y accesos (asignación por transferencia)
   * ------------------------------------------------------------------ */
  function initRolesAccesos() {
    var selectorRol = document.getElementById('rol-selector');
    var campoClave = document.getElementById('rol-clave');
    var campoNombre = document.getElementById('rol-nombre');
    var campoDescripcion = document.getElementById('rol-descripcion');
    var listaAccesosIzq = document.getElementById('accesos-disponibles');
    var listaAccesosDer = document.getElementById('accesos-asignados');
    var cajaMsg = document.getElementById('roles-msg');
    if (!selectorRol || !campoClave || !campoNombre || !campoDescripcion || !listaAccesosIzq || !listaAccesosDer) return;

    var sesion = leerSesion();
    var modo = 'consulta';
    var claveEdicion = '';
    var rolesBase = [];
    var accesosBase = [];
    var usuariosBase = [];
    var soloConsulta = permisoDe('1', claveRol(sesion.rol)) !== 'full';

    function mensaje(texto, tipo) {
      if (!cajaMsg) { toast(texto, tipo === 'ok' ? 'info' : 'error'); return; }
      cajaMsg.className = 'msj ' + (tipo || '');
      cajaMsg.textContent = texto;
      cajaMsg.hidden = false;
    }
    function ocultarMensaje() { if (cajaMsg) { cajaMsg.textContent = ''; cajaMsg.hidden = true; } }
    function opcion(texto, valor) {
      var o = document.createElement('option'); o.value = valor; o.textContent = texto; return o;
    }
    function valores(lista) { return Array.prototype.slice.call(lista.options).map(function (o) { return o.value; }); }
    function ordena(lista) {
      Array.prototype.slice.call(lista.options).sort(function (a, b) { return a.textContent.localeCompare(b.textContent); }).forEach(function (o) { lista.appendChild(o); });
    }
    function pintarSelector() {
      var elegido = selectorRol.value;
      selectorRol.innerHTML = '';
      selectorRol.appendChild(opcion('Seleccione un rol', ''));
      rolesBase.forEach(function (rol) { selectorRol.appendChild(opcion(rol.nombre + ' (' + rol.clave + ')', rol.clave)); });
      if (rolesBase.some(function (r) { return r.clave === elegido; })) selectorRol.value = elegido;
    }
    function pintarAccesos() {
      var asignados = [];
      rolesBase.forEach(function (r) { if (r.clave === claveEdicion) asignados = r.accesos || []; });
      listaAccesosIzq.innerHTML = ''; listaAccesosDer.innerHTML = '';
      accesosBase.forEach(function (a) {
        var o = opcion(a.nombre, a.id);
        (asignados.indexOf(a.id) !== -1 ? listaAccesosDer : listaAccesosIzq).appendChild(o);
      });
      ordena(listaAccesosIzq); ordena(listaAccesosDer);
    }
    function bloquearCampos(bloquear) {
      campoClave.readOnly = bloquear || modo === 'edicion';
      campoNombre.readOnly = bloquear;
      campoDescripcion.readOnly = bloquear;
      selectorRol.disabled = modo === 'nuevo';
      document.querySelectorAll('.btn-traslado').forEach(function (b) { b.disabled = soloConsulta || bloquear; });
      ['t-nuevo', 't-borrar', 't-modif'].forEach(function (id) {
        var b = document.getElementById(id); if (b) b.disabled = soloConsulta;
      });
    }
    function limpiar() {
      modo = 'consulta'; claveEdicion = '';
      campoClave.value = ''; campoNombre.value = ''; campoDescripcion.value = ''; selectorRol.value = '';
      bloquearCampos(true); pintarAccesos(); ocultarMensaje();
    }
    function cargarRol(clave) {
      var rol = rolesBase.find(function (r) { return r.clave === clave; });
      if (!rol) { limpiar(); return; }
      modo = 'consulta'; claveEdicion = rol.clave;
      campoClave.value = rol.clave; campoNombre.value = rol.nombre; campoDescripcion.value = rol.descripcion || '';
      selectorRol.value = rol.clave; bloquearCampos(true); pintarAccesos(); ocultarMensaje();
    }
    function iniciarNuevo() {
      if (soloConsulta) return;
      modo = 'nuevo'; claveEdicion = ''; campoClave.value = ''; campoNombre.value = ''; campoDescripcion.value = ''; selectorRol.value = '';
      bloquearCampos(false); pintarAccesos(); mensaje('Captura una clave y nombre únicos, describe el rol y asigna permisos. Esto no crea ni cambia cuentas.', 'av'); campoClave.focus();
    }
    function habilitarEdicion() {
      if (soloConsulta) return;
      if (!claveEdicion) { iniciarNuevo(); return; }
      modo = 'edicion'; bloquearCampos(false); mensaje('Edita los datos y permisos. Quitar permisos requiere confirmación.', 'av'); campoNombre.focus();
    }
    function validar(nuevo) {
      if (!nuevo.clave) return 'Captura la clave del rol.';
      if (!/^[a-z0-9][a-z0-9_-]{1,29}$/i.test(nuevo.clave)) return 'La clave debe tener de 2 a 30 caracteres (letras, números, guion o guion bajo).';
      if (!nuevo.nombre) return 'Captura el nombre del rol.';
      if (rolesBase.some(function (r) { return normalizar(r.clave) === normalizar(nuevo.clave) && r.clave !== claveEdicion; })) return 'La clave del rol ya existe.';
      if (rolesBase.some(function (r) { return normalizar(r.nombre) === normalizar(nuevo.nombre) && r.clave !== claveEdicion; })) return 'El nombre del rol ya existe.';
      return '';
    }
    function auditar(accion, rol) {
      /* Bitácora de demostración en este navegador; no es auditoría compartida ni segura. */
      try {
        var clave = 'nz_auditoria_roles_demo';
        var eventos = JSON.parse(localStorage.getItem(clave) || '[]');
        eventos.push({ actor: sesion.usuario || 'sin-sesion', fecha: new Date().toISOString(), accion: accion, rol: rol });
        localStorage.setItem(clave, JSON.stringify(eventos.slice(-100)));
      } catch (e) { console.warn('No se pudo registrar la bitácora local de demostración.', e); }
    }
    function guardarEdicion() {
      if (soloConsulta) { mensaje('Tu perfil no puede administrar roles.', 'er'); return; }
      var nuevo = { clave: campoClave.value.trim(), nombre: campoNombre.value.trim(), descripcion: campoDescripcion.value.trim(), accesos: valores(listaAccesosDer) };
      var error = validar(nuevo);
      if (error) { mensaje(error, 'er'); toast(error, 'error'); return; }
      var anterior = rolesBase.find(function (r) { return r.clave === claveEdicion; });
      var removidos = anterior ? (anterior.accesos || []).filter(function (id) { return nuevo.accesos.indexOf(id) === -1; }) : [];
      if (removidos.length && !window.confirm('Vas a retirar ' + removidos.length + ' permiso(s) del rol. ¿Confirmas el cambio?')) return;
      var alta = modo === 'nuevo';
      guardarRol(nuevo); auditar(alta ? 'crear' : (removidos.length ? 'editar_quitando_permisos' : 'editar'), nuevo.clave);
      recargarRoles().then(function (resultado) {
        rolesBase = resultado.roles; pintarSelector(); cargarRol(nuevo.clave);
        mensaje(alta ? 'Rol creado. Las asignaciones de usuarios no cambiaron.' : 'Rol actualizado. Las asignaciones de usuarios no cambiaron.', 'ok');
        toast(alta ? 'Rol creado correctamente.' : 'Rol actualizado correctamente.');
      }).catch(function () { mensaje('No se pudieron guardar los cambios del rol.', 'er'); });
    }
    function borrarRolSeleccionado() {
      if (soloConsulta) return;
      if (!claveEdicion) { mensaje('Selecciona el rol que deseas eliminar.', 'er'); return; }
      var asignado = usuariosBase.some(function (u) {
        return normalizar(u.rol) === normalizar((rolesBase.find(function (r) { return r.clave === claveEdicion; }) || {}).nombre) || normalizar(u.rol) === normalizar(claveEdicion);
      });
      if (asignado) { mensaje('No se puede eliminar este rol porque todavía está asignado a una cuenta. Reasigna esas cuentas primero en “Asignación de roles a usuarios”.', 'er'); return; }
      if (!window.confirm('¿Eliminar el rol “' + (campoNombre.value || claveEdicion) + '”?')) return;
      borrarRol(claveEdicion); auditar('eliminar', claveEdicion);
      recargarRoles().then(function (resultado) { rolesBase = resultado.roles; pintarSelector(); limpiar(); mensaje('Rol eliminado.', 'ok'); }).catch(function () { mensaje('No se pudo eliminar el rol.', 'er'); });
    }
    function transferir(boton) {
      if (soloConsulta || modo === 'consulta') { mensaje('Pulsa Nuevo o Modif para editar permisos.', 'av'); return; }
      var derecha = boton.getAttribute('data-dir') === '1';
      var origen = derecha ? listaAccesosIzq : listaAccesosDer;
      var destino = derecha ? listaAccesosDer : listaAccesosIzq;
      var todos = boton.getAttribute('data-todo') === '1';
      var seleccion = Array.prototype.slice.call(origen.options).filter(function (o) { return todos || o.selected; });
      if (!seleccion.length) { toast('Selecciona al menos un permiso.'); return; }
      seleccion.forEach(function (o) { origen.removeChild(o); o.selected = false; destino.appendChild(o); });
      ordena(origen); ordena(destino);
    }
    selectorRol.addEventListener('change', function () { selectorRol.value ? cargarRol(selectorRol.value) : limpiar(); });
    document.querySelectorAll('.btn-traslado[data-lista="accesos"]').forEach(function (b) { b.addEventListener('click', function () { transferir(b); }); });
    var nuevo = document.getElementById('t-nuevo'), borrar = document.getElementById('t-borrar'), modificar = document.getElementById('t-modif');
    var consultar = document.getElementById('t-consul'), cancelar = document.getElementById('t-cancel'), salir = document.getElementById('t-salir');
    if (nuevo) nuevo.addEventListener('click', iniciarNuevo);
    if (borrar) borrar.addEventListener('click', borrarRolSeleccionado);
    if (modificar) modificar.addEventListener('click', function () { modo === 'consulta' ? habilitarEdicion() : guardarEdicion(); });
    if (consultar) consultar.addEventListener('click', function () { selectorRol.value ? cargarRol(selectorRol.value) : mensaje('Selecciona un rol para consultar.', 'er'); });
    if (cancelar) cancelar.addEventListener('click', function () { claveEdicion ? cargarRol(claveEdicion) : limpiar(); toast('Operación cancelada.'); });
    if (salir) salir.addEventListener('click', function () { window.location.href = 'inicio.html'; });
    Promise.all([cargarRoles(), cargarDatos()]).then(function (res) {
      rolesBase = res[0].roles; accesosBase = res[0].accesos; usuariosBase = res[1].usuarios;
      pintarSelector();
      if (soloConsulta) mensaje('Acceso de consulta: no puedes crear, editar ni eliminar roles.', 'av');
      if (rolesBase.length) cargarRol(rolesBase[0].clave); else limpiar();
      if (soloConsulta) mensaje('Acceso de consulta: no puedes crear, editar ni eliminar roles.', 'av');
    }).catch(function (error) { console.error(error); mensaje('No se pudieron leer los roles y accesos. Verifica que el proyecto esté servido por HTTP.', 'er'); });
  }
  initRolesAccesos();

  /* ------------------------------------------------------------------
   * Módulo: asignación de roles a usuarios (rol por cuenta)
   * ------------------------------------------------------------------ */
  function initAsignacionRoles() {
    var selectorUsuario = document.getElementById('asig-usuario');
    if (!selectorUsuario) return;

    var selectorRol = document.getElementById('asig-rol');
    var filtroRol = document.getElementById('asig-filtro-rol');
    var campoLogin = document.getElementById('asig-login');
    var campoRolActual = document.getElementById('asig-rol-actual');
    var campoVigencia = document.getElementById('asig-vigencia');
    var campoEstado = document.getElementById('asig-estado');
    var campoBuscar = document.getElementById('asig-buscar');
    var filtroEstado = document.getElementById('asig-filtro-estado');
    var cuerpo = document.getElementById('cuerpo-asignacion');
    var cajaMsg = document.getElementById('asig-msg');
    var cajaError = document.getElementById('asig-error');
    var cajaPie = document.getElementById('asig-pie');
    var cajaKpis = document.getElementById('roles-kpis');

    var sesion = leerSesion();
    var rolesBase = [];
    var usuariosBase = [];
    var mapaPersonas = {};

    function mostrarMsg(texto, tipo) {
      if (!cajaMsg) {
        toast(texto, tipo === 'ok' ? 'info' : 'error');
        return;
      }

      cajaMsg.className = 'msj ' + (tipo || '');
      cajaMsg.textContent = texto;
      cajaMsg.hidden = false;
    }

    function ocultarMsg() {
      if (!cajaMsg) return;
      cajaMsg.textContent = '';
      cajaMsg.hidden = true;
    }

    function mostrarError(texto) {
      if (!cajaError) {
        toast(texto, 'error');
        return;
      }

      cajaError.textContent = texto;
      cajaError.hidden = false;
      toast(texto, 'error');
    }

    function limpiarError() {
      if (!cajaError) return;
      cajaError.textContent = '';
      cajaError.hidden = true;
    }

    function nuevaOpcion(texto, valor) {
      var opcion = document.createElement('option');
      opcion.value = valor;
      opcion.textContent = texto;
      return opcion;
    }

    function buscarRol(clave) {
      var encontrado = null;
      rolesBase.forEach(function (rol) {
        if (rol.clave === clave) encontrado = rol;
      });
      return encontrado;
    }

    function buscarUsuario(login) {
      var encontrado = null;
      usuariosBase.forEach(function (usuario) {
        if (usuario.usuario === login) encontrado = usuario;
      });
      return encontrado;
    }

    function nombreDe(usuario) {
      var persona = mapaPersonas[usuario.idPersona];
      return persona ? nombreCompletoDe(persona) : usuario.usuario;
    }

    function etiquetaUsuario(usuario) {
      return nombreDe(usuario) + ' (' + usuario.usuario + ')';
    }

    function estadoDe(usuario) {
      return String(usuario.estado).toLowerCase() !== 'false' ? 'ACTIVO' : 'INACTIVO';
    }

    function claveDeRol(usuario) {
      var buscado = normalizar(usuario.rol || '');
      if (!buscado) return '';

      var coincidencia = '';
      rolesBase.forEach(function (rol) {
        if (coincidencia) return;
        if (normalizar(rol.nombre) === buscado || normalizar(rol.clave) === buscado) {
          coincidencia = rol.clave;
        }
      });

      return coincidencia;
    }

    function nombreDeRol(usuario) {
      var clave = claveDeRol(usuario);
      if (clave) return buscarRol(clave).nombre;

      var texto = String(usuario.rol || '').trim();
      if (!texto || normalizar(texto) === normalizar('Sin rol asignado')) return 'Sin rol asignado';
      return texto;
    }

    function tieneRol(usuario) {
      return claveDeRol(usuario) !== '';
    }

    function pintarKpis() {
      if (!cajaKpis) return;

      var conRol = 0;
      var activas = 0;

      usuariosBase.forEach(function (usuario) {
        if (tieneRol(usuario)) conRol += 1;
        if (estadoDe(usuario) === 'ACTIVO') activas += 1;
      });

      var datos = [
        { n: usuariosBase.length, t: 'Usuarios registrados' },
        { n: conRol, t: 'Usuarios con rol asignado' },
        { n: usuariosBase.length - conRol, t: 'Usuarios sin rol asignado' },
        { n: activas, t: 'Cuentas activas' }
      ];

      var html = '';
      datos.forEach(function (dato, indice) {
        var clase = indice === 3 ? ' kpi k3' : (indice === 2 ? ' kpi k2' : (indice === 1 ? ' kpi k1' : ' kpi'));
        html += '<div class="' + clase + '"><div class="n">' + dato.n + '</div><div class="t">' + escapar(dato.t) + '</div></div>';
      });

      cajaKpis.innerHTML = html;
    }

    function pintarSelectorUsuarios(seleccion) {
      var actual = seleccion || selectorUsuario.value;
      selectorUsuario.innerHTML = '';
      selectorUsuario.appendChild(nuevaOpcion('Seleccione el nombre de la persona', ''));

      var ordenados = usuariosBase.slice().sort(function (a, b) {
        return etiquetaUsuario(a).localeCompare(etiquetaUsuario(b));
      });

      ordenados.forEach(function (usuario) {
        selectorUsuario.appendChild(nuevaOpcion(etiquetaUsuario(usuario), usuario.usuario));
      });

      if (actual && buscarUsuario(actual)) selectorUsuario.value = actual;
    }

    function pintarSelectorRoles() {
      var seleccion = selectorRol.value;
      var filtro = filtroRol ? filtroRol.value : '';

      selectorRol.innerHTML = '';
      selectorRol.appendChild(nuevaOpcion('Seleccione un rol', ''));

      if (filtroRol) {
        filtroRol.innerHTML = '';
        filtroRol.appendChild(nuevaOpcion('Todos los roles', ''));
      }

      rolesBase.forEach(function (rol) {
        selectorRol.appendChild(nuevaOpcion(rol.nombre + ' (' + rol.clave + ')', rol.clave));
        if (filtroRol) filtroRol.appendChild(nuevaOpcion(rol.nombre, rol.clave));
      });

      if (seleccion && buscarRol(seleccion)) selectorRol.value = seleccion;
      if (filtroRol && filtro && buscarRol(filtro)) filtroRol.value = filtro;
    }

    function pintarTabla() {
      if (!cuerpo) return;

      var texto = normalizar(campoBuscar ? campoBuscar.value : '');
      var rolFiltro = filtroRol ? filtroRol.value : '';
      var estadoFiltro = filtroEstado ? filtroEstado.value : '';
      var visibles = 0;

      cuerpo.innerHTML = '';

      var ordenados = usuariosBase.slice().sort(function (a, b) {
        return nombreDe(a).localeCompare(nombreDe(b));
      });

      ordenados.forEach(function (usuario) {
        var nombre = nombreDe(usuario);
        var estado = estadoDe(usuario);
        var clave = claveDeRol(usuario);

        if (texto && normalizar(nombre + ' ' + usuario.usuario).indexOf(texto) === -1) return;
        if (rolFiltro && clave !== rolFiltro) return;
        if (estadoFiltro && estado.toLowerCase() !== estadoFiltro) return;

        visibles += 1;

        var fila = document.createElement('tr');
        if (sesion && sesion.usuario === usuario.usuario) fila.setAttribute('data-propia', '1');

        var celdaNombre = document.createElement('td');
        celdaNombre.textContent = nombre;
        if (!clave) {
          var aviso = document.createElement('span');
          aviso.className = 'tag naran';
          aviso.textContent = 'Sin rol';
          celdaNombre.appendChild(document.createTextNode(' '));
          celdaNombre.appendChild(aviso);
        }
        fila.appendChild(celdaNombre);

        var celdaLogin = document.createElement('td');
        celdaLogin.textContent = usuario.usuario;
        fila.appendChild(celdaLogin);

        var celdaRol = document.createElement('td');
        celdaRol.textContent = nombreDeRol(usuario);
        fila.appendChild(celdaRol);

        var celdaIni = document.createElement('td');
        celdaIni.textContent = usuario.fecIni || '—';
        fila.appendChild(celdaIni);

        var celdaFin = document.createElement('td');
        celdaFin.textContent = usuario.fecFin || '—';
        fila.appendChild(celdaFin);

        var celdaEstado = document.createElement('td');
        var etiqueta = document.createElement('span');
        etiqueta.className = 'tag ' + (estado === 'ACTIVO' ? 'verde' : 'rojo');
        etiqueta.textContent = estado;
        celdaEstado.appendChild(etiqueta);
        fila.appendChild(celdaEstado);

        var celdaAccion = document.createElement('td');
        var boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'btn2';
        boton.setAttribute('data-real', '');
        boton.textContent = 'Asignar rol';
        boton.addEventListener('click', function () {
          cargarUsuario(usuario.usuario);
        });
        celdaAccion.appendChild(boton);
        fila.appendChild(celdaAccion);

        cuerpo.appendChild(fila);
      });

      if (cajaPie) {
        cajaPie.hidden = visibles === usuariosBase.length;
        cajaPie.textContent = 'Mostrando ' + visibles + ' de ' + usuariosBase.length + ' usuario(s).';
      }
    }

    function pintarTodo() {
      pintarKpis();
      pintarSelectorUsuarios('');
      pintarSelectorRoles();
      pintarTabla();
    }

    function limpiarFormulario() {
      selectorUsuario.value = '';
      if (selectorRol) selectorRol.value = '';
      if (campoLogin) campoLogin.value = '—';
      if (campoRolActual) campoRolActual.value = '—';
      if (campoVigencia) campoVigencia.value = '—';
      if (campoEstado) campoEstado.value = '—';
      limpiarError();
    }

    function cargarUsuario(login) {
      var usuario = buscarUsuario(login);
      limpiarError();
      ocultarMsg();

      if (!usuario) {
        limpiarFormulario();
        return;
      }

      selectorUsuario.value = usuario.usuario;
      campoLogin.value = usuario.usuario;
      campoRolActual.value = nombreDeRol(usuario);
      campoVigencia.value = (usuario.fecIni || '—') + ' — ' + (usuario.fecFin || '—');
      campoEstado.value = estadoDe(usuario);

      var clave = claveDeRol(usuario);
      if (selectorRol) selectorRol.value = clave;

      mostrarMsg('Rol vigente de ' + nombreDe(usuario) + ': ' + nombreDeRol(usuario) + '.', 'av');
    }

    function recargar() {
      return Promise.all([cargarRoles(), cargarDatos()]).then(function (resultados) {
        rolesBase = resultados[0].roles;
        usuariosBase = resultados[1].usuarios;
        mapaPersonas = resultados[1].mapaPersonas;
        return usuariosBase;
      });
    }

    function aplicarCambio(login, nombreRol, mensajeOk) {
      guardarCambioUsuario(login, { rol: nombreRol });

      var esCuentaPropia = login === sesion.usuario;
      if (esCuentaPropia) sessionStorage.setItem('nz_rol', nombreRol);

      recargar().then(function () {
        pintarTodo();
        cargarUsuario(login);
        mostrarMsg(mensajeOk, 'ok');
        toast(mensajeOk);

        if (esCuentaPropia) {
          setTimeout(function () {
            window.location.reload();
          }, 1000);
        }
      }).catch(function () {
        mostrarMsg('No se pudieron guardar los cambios del rol.', 'er');
      });
    }

    function guardar() {
      var login = selectorUsuario.value;
      if (!login) {
        mostrarError('Selecciona el usuario al que deseas asignar el rol.');
        return;
      }

      var clave = selectorRol ? selectorRol.value : '';
      if (!clave) {
        mostrarError('Selecciona el rol que deseas asignar.');
        return;
      }

      var rol = buscarRol(clave);
      if (!rol) {
        mostrarError('El rol seleccionado ya no existe. Vuelve a cargar la pantalla.');
        return;
      }

      var usuario = buscarUsuario(login);
      if (!usuario) {
        mostrarError('El usuario seleccionado ya no existe.');
        return;
      }

      if (nombreDeRol(usuario) === rol.nombre) {
        mostrarMsg(nombreDe(usuario) + ' ya tiene asignado el rol "' + rol.nombre + '".', 'av');
        return;
      }

      if (login === sesion.usuario && !window.confirm('Vas a cambiar el rol de la cuenta con la que iniciaste sesión. ¿Deseas continuar?')) {
        return;
      }

      aplicarCambio(login, rol.nombre, 'Rol "' + rol.nombre + '" asignado a ' + nombreDe(usuario) + '.');
    }

    function quitarRol() {
      var login = selectorUsuario.value;
      if (!login) {
        mostrarError('Selecciona el usuario al que deseas quitar el rol.');
        return;
      }

      var usuario = buscarUsuario(login);
      if (!usuario) {
        mostrarError('El usuario seleccionado ya no existe.');
        return;
      }

      if (!tieneRol(usuario)) {
        mostrarMsg(nombreDe(usuario) + ' no tiene rol asignado.', 'av');
        return;
      }

      var mensaje = 'Quitar el rol "' + nombreDeRol(usuario) + '" a ' + nombreDe(usuario) + '?';
      if (!window.confirm(mensaje)) return;

      aplicarCambio(login, 'Sin rol asignado', 'Rol retirado a ' + nombreDe(usuario) + '.');
    }

    selectorUsuario.addEventListener('change', function () {
      if (!selectorUsuario.value) {
        limpiarFormulario();
        return;
      }
      cargarUsuario(selectorUsuario.value);
    });

    [campoBuscar, filtroRol, filtroEstado].forEach(function (campo) {
      if (!campo) return;
      campo.addEventListener(campo.tagName === 'SELECT' ? 'change' : 'input', pintarTabla);
    });

    var botonGuardar = document.getElementById('asig-guardar');
    var botonQuitar = document.getElementById('asig-quitar');
    var botonCancelar = document.getElementById('asig-cancelar');
    var botonSalir = document.getElementById('asig-salir');

    if (botonGuardar) botonGuardar.addEventListener('click', guardar);
    if (botonQuitar) botonQuitar.addEventListener('click', quitarRol);
    if (botonCancelar) botonCancelar.addEventListener('click', function () {
      limpiarFormulario();
      ocultarMsg();
      pintarTabla();
      toast('Operación cancelada.');
    });
    if (botonSalir) botonSalir.addEventListener('click', function () {
      window.location.href = 'inicio.html';
    });

    recargar().then(function () {
      pintarTodo();
      mostrarMsg('Selecciona un usuario para consultar o cambiar su rol.', 'av');
    }).catch(function (error) {
      console.error(error);
      mostrarMsg('No se pudieron leer los usuarios y los roles del sistema. Verifica que el proyecto esté servido por un servidor local.', 'er');
    });
  }

  initAsignacionRoles();

  /* ------------------------------------------------------------------
   * Módulo: catálogos del sistema (relaciones mCatalogos y mCatalogosDet)
   * ------------------------------------------------------------------ */
  var RUTA_CATALOGOS = 'catalogos.txt';
  var RUTA_CATALOGOS_REGISTROS = 'catalogos-registros.txt';
  var CLAVE_RESPALDO_CATALOGOS = 'nz_catalogos_respaldo';

  function parsearCatalogos(texto) {
    return String(texto).split(/\r?\n/).reduce(function (lista, linea, indice) {
      var limpia = linea.trim();

      if (!limpia || limpia.charAt(0) === '#') return lista;

      var partes = limpia.split('|');
      if (partes.length < 3) {
        console.warn('catalogos.txt: la línea ' + (indice + 1) + ' no tiene el formato id_catalogo|nombre|descripcion.');
        return lista;
      }

      lista.push({
        id: partes[0].trim(),
        nombre: partes[1].trim(),
        descripcion: partes[2].trim()
      });

      return lista;
    }, []);
  }

  function parsearCatalogosRegistros(texto) {
    return String(texto).split(/\r?\n/).reduce(function (lista, linea, indice) {
      var limpia = linea.trim();

      if (!limpia || limpia.charAt(0) === '#') return lista;

      var partes = limpia.split('|');
      if (partes.length < 3) {
        console.warn('catalogos-registros.txt: la línea ' + (indice + 1) + ' no tiene el formato id_catalogo|clave|descripcion.');
        return lista;
      }

      lista.push({
        catalogo: partes[0].trim(),
        clave: partes[1].trim(),
        descripcion: partes[2].trim()
      });

      return lista;
    }, []);
  }

  var promesaCatalogos = null;
  var CATALOGOS = [];
  var REGISTROS_ARCHIVO = [];
  var REGISTROS = [];

  function leerRespaldoCatalogos() {
    return leerObjetoLocal(CLAVE_RESPALDO_CATALOGOS);
  }

  function escribirRespaldoCatalogos(mapa) {
    localStorage.setItem(CLAVE_RESPALDO_CATALOGOS, JSON.stringify(mapa));
  }

  function respaldoDelCatalogo(mapa, idCatalogo) {
    if (!mapa[idCatalogo]) mapa[idCatalogo] = { __nuevos: {}, __modificados: {}, __borrados: [] };

    var respaldo = mapa[idCatalogo];
    respaldo.__nuevos = respaldo.__nuevos || {};
    respaldo.__modificados = respaldo.__modificados || {};
    respaldo.__borrados = respaldo.__borrados || [];
    return respaldo;
  }

  function aplicarRespaldoCatalogos(registros) {
    var respaldo = leerRespaldoCatalogos();
    var lista = [];

    registros.forEach(function (registro) {
      var resp = respaldo[registro.catalogo];
      if (!resp) {
        lista.push(registro);
        return;
      }

      if ((resp.__borrados || []).indexOf(registro.clave) !== -1) return;

      var cambio = (resp.__modificados || {})[registro.clave];
      lista.push({
        catalogo: registro.catalogo,
        clave: registro.clave,
        descripcion: cambio && typeof cambio.descripcion === 'string' ? cambio.descripcion : registro.descripcion
      });
    });

    Object.keys(respaldo).forEach(function (idCatalogo) {
      var resp = respaldo[idCatalogo];

      Object.keys(resp.__nuevos || {}).forEach(function (clave) {
        if ((resp.__borrados || []).indexOf(clave) !== -1) return;

        var repetido = lista.some(function (registro) {
          return registro.catalogo === idCatalogo && registro.clave === clave;
        });
        if (!repetido) lista.push(resp.__nuevos[clave]);
      });
    });

    return lista;
  }

  function guardarRegistroCatalogo(registro) {
    var respaldo = leerRespaldoCatalogos();
    var resp = respaldoDelCatalogo(respaldo, registro.catalogo);
    var existeEnArchivo = REGISTROS_ARCHIVO.some(function (candidato) {
      return candidato.catalogo === registro.catalogo && candidato.clave === registro.clave;
    });

    resp.__borrados = resp.__borrados.filter(function (clave) { return clave !== registro.clave; });

    if (existeEnArchivo) {
      resp.__modificados[registro.clave] = { descripcion: registro.descripcion };
      delete resp.__nuevos[registro.clave];
    } else {
      resp.__nuevos[registro.clave] = registro;
      delete resp.__modificados[registro.clave];
    }

    escribirRespaldoCatalogos(respaldo);
    promesaCatalogos = null;
  }

  function borrarRegistroCatalogo(idCatalogo, clave) {
    var respaldo = leerRespaldoCatalogos();
    var resp = respaldoDelCatalogo(respaldo, idCatalogo);

    if (resp.__borrados.indexOf(clave) === -1) resp.__borrados.push(clave);
    delete resp.__nuevos[clave];
    delete resp.__modificados[clave];

    escribirRespaldoCatalogos(respaldo);
    promesaCatalogos = null;
  }

  function cargarCatalogos() {
    if (promesaCatalogos) return promesaCatalogos;

    promesaCatalogos = Promise.all([
      leerTexto(RUTA_CATALOGOS),
      leerTexto(RUTA_CATALOGOS_REGISTROS)
    ]).then(function (resultados) {
      CATALOGOS = parsearCatalogos(resultados[0]);
      REGISTROS_ARCHIVO = parsearCatalogosRegistros(resultados[1]);
      REGISTROS = aplicarRespaldoCatalogos(REGISTROS_ARCHIVO);
      return { catalogos: CATALOGOS, registros: REGISTROS };
    }).catch(function (error) {
      promesaCatalogos = null;
      throw error;
    });

    return promesaCatalogos;
  }

  function recargarCatalogos() {
    promesaCatalogos = null;
    return cargarCatalogos();
  }

  function siguienteClaveCatalogo(idCatalogo, registros) {
    var prefijo = String(idCatalogo || '').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
    if (!prefijo) prefijo = 'CAT';

    var maximo = 0;

    registros.forEach(function (registro) {
      if (registro.catalogo !== idCatalogo) return;
      var coincidencia = new RegExp('^' + prefijo + '-(\\d+)$', 'i').exec(String(registro.clave || '').trim());
      if (coincidencia) maximo = Math.max(maximo, parseInt(coincidencia[1], 10));
    });

    var siguiente = String(maximo + 1);
    while (siguiente.length < 3) siguiente = '0' + siguiente;
    return prefijo + '-' + siguiente;
  }

  function initCatalogoMantenimiento() {
    var selectCatalogo = document.getElementById('cat-nombre');
    var campoDescripcion = document.getElementById('cat-descripcion');
    var cuerpo = document.getElementById('cat-cuerpo');
    var pie = document.getElementById('cat-pie');
    var cajaMsg = document.getElementById('cat-msg');

    if (!selectCatalogo || !campoDescripcion || !cuerpo) return;

    var botonNuevo = document.getElementById('cat-nuevo');
    var botonConsultar = document.getElementById('cat-consultar');
    var botonEliminar = document.getElementById('cat-eliminar');
    var botonModificar = document.getElementById('cat-modificar');
    var botonCancelar = document.getElementById('cat-cancelar');
    var botonSalir = document.getElementById('cat-salir');

    var modo = 'consulta';        /* consulta | nuevo | edicion */
    var catalogoActual = '';
    var claveSel = '';
    var filtro = '';
    var soloConsulta = false;

    function mostrarMsg(texto, tipo) {
      if (!cajaMsg) {
        toast(texto, tipo === 'er' ? 'error' : 'info');
        return;
      }

      cajaMsg.className = 'msj ' + (tipo || '');
      cajaMsg.textContent = texto;
      cajaMsg.hidden = false;
    }

    function ocultarMsg() {
      if (!cajaMsg) return;
      cajaMsg.textContent = '';
      cajaMsg.hidden = true;
    }

    function catalogoSeleccionado() {
      var encontrado = null;
      CATALOGOS.forEach(function (catalogo) {
        if (catalogo.id === catalogoActual) encontrado = catalogo;
      });
      return encontrado;
    }

    function registroPorClave(clave) {
      var encontrado = null;
      REGISTROS.forEach(function (registro) {
        if (registro.catalogo === catalogoActual && registro.clave === clave) encontrado = registro;
      });
      return encontrado;
    }

    function registrosVisibles() {
      return REGISTROS.filter(function (registro) {
        if (registro.catalogo !== catalogoActual) return false;
        if (!filtro) return true;

        var texto = normalizar(filtro);
        return normalizar(registro.clave).indexOf(texto) !== -1 ||
          normalizar(registro.descripcion).indexOf(texto) !== -1;
      });
    }

    function pintarTabla() {
      cuerpo.innerHTML = '';
      var visibles = registrosVisibles();

      visibles.forEach(function (registro) {
        var fila = document.createElement('tr');
        fila.setAttribute('data-clave', registro.clave);
        if (registro.clave === claveSel) fila.className = 'sel';

        var celdaClave = document.createElement('td');
        celdaClave.className = 'mono';
        celdaClave.textContent = registro.clave;

        var celdaDescripcion = document.createElement('td');
        celdaDescripcion.textContent = registro.descripcion;

        fila.appendChild(celdaClave);
        fila.appendChild(celdaDescripcion);

        fila.addEventListener('click', function () {
          claveSel = registro.clave;
          modo = 'consulta';
          pintarTabla();
          mostrarMsg('Registro "' + registro.clave + '" seleccionado. Pulsa Modificar o Eliminar.', 'av');
        });

        cuerpo.appendChild(fila);
      });

      if (!visibles.length) {
        var filaVacia = document.createElement('tr');
        var celdaVacia = document.createElement('td');
        celdaVacia.colSpan = 2;
        celdaVacia.style.color = '#8A97A4';
        celdaVacia.textContent = catalogoActual
          ? 'Sin registros que mostrar en este catálogo.'
          : 'Seleccione un catálogo para ver sus registros.';
        filaVacia.appendChild(celdaVacia);
        cuerpo.appendChild(filaVacia);
      }

      if (pie) {
        pie.hidden = false;
        pie.textContent = visibles.length + (visibles.length === 1 ? ' registro' : ' registros') +
          (filtro ? ' que coinciden con "' + filtro + '"' : ' en el catálogo');
      }
    }

    function pintarSelector() {
      var seleccion = selectCatalogo.value;
      selectCatalogo.innerHTML = '';

      var opcionVacia = document.createElement('option');
      opcionVacia.value = '';
      opcionVacia.textContent = 'Seleccione un catálogo';
      selectCatalogo.appendChild(opcionVacia);

      CATALOGOS.forEach(function (catalogo) {
        var opcion = document.createElement('option');
        opcion.value = catalogo.id;
        opcion.textContent = catalogo.nombre;
        selectCatalogo.appendChild(opcion);
      });

      if (CATALOGOS.some(function (catalogo) { return catalogo.id === seleccion; })) {
        selectCatalogo.value = seleccion;
      }
    }

    function bloquearEscritura(bloquear) {
      [botonNuevo, botonModificar, botonEliminar].forEach(function (boton) {
        if (boton) boton.disabled = bloquear;
      });
    }

    function validarDescripcion(descripcion, clavePropia) {
      if (!descripcion) return 'Captura la descripción del registro.';
      if (descripcion.length < 3) return 'La descripción debe tener al menos 3 caracteres.';

      var repetido = REGISTROS.some(function (registro) {
        if (registro.catalogo !== catalogoActual) return false;
        if (clavePropia && registro.clave === clavePropia) return false;
        return normalizar(registro.descripcion) === normalizar(descripcion);
      });
      if (repetido) return 'Ya existe un registro con esa descripción en este catálogo.';

      return '';
    }

    function iniciarNuevo() {
      if (soloConsulta) {
        mostrarMsg('Tu perfil tiene acceso de solo consulta en este módulo: no puedes dar de alta registros.', 'er');
        return;
      }

      if (!catalogoActual) {
        mostrarMsg('Selecciona un catálogo en el campo "Nombre de Catálogo".', 'er');
        return;
      }

      modo = 'nuevo';
      claveSel = '';
      filtro = '';
      campoDescripcion.value = '';
      pintarTabla();
      mostrarMsg('Captura la descripción del nuevo registro y vuelve a pulsar "Nuevo / Grabar".', 'av');
      campoDescripcion.focus();
    }

    function grabarNuevo() {
      if (soloConsulta) {
        mostrarMsg('Tu perfil tiene acceso de solo consulta en este módulo: no puedes dar de alta registros.', 'er');
        return;
      }

      var descripcion = campoDescripcion.value.trim();
      var error = validarDescripcion(descripcion, '');

      if (error) {
        mostrarMsg(error, 'er');
        toast(error, 'error');
        campoDescripcion.focus();
        return;
      }

      var clave = siguienteClaveCatalogo(catalogoActual, REGISTROS);
      guardarRegistroCatalogo({ catalogo: catalogoActual, clave: clave, descripcion: descripcion });

      recargarCatalogos().then(function () {
        modo = 'consulta';
        claveSel = clave;
        filtro = '';
        campoDescripcion.value = '';
        pintarTabla();
        mostrarMsg('Registro "' + clave + '" guardado en el catálogo.', 'ok');
        toast('Registro guardado correctamente.');
      }).catch(function () {
        mostrarMsg('No se pudo guardar el registro.', 'er');
      });
    }

    function modificar() {
      if (soloConsulta) {
        mostrarMsg('Tu perfil tiene acceso de solo consulta en este módulo: no puedes modificar registros.', 'er');
        return;
      }

      if (modo === 'edicion') {
        var descripcion = campoDescripcion.value.trim();
        var error = validarDescripcion(descripcion, claveSel);

        if (error) {
          mostrarMsg(error, 'er');
          toast(error, 'error');
          campoDescripcion.focus();
          return;
        }

        guardarRegistroCatalogo({ catalogo: catalogoActual, clave: claveSel, descripcion: descripcion });

        recargarCatalogos().then(function () {
          modo = 'consulta';
          campoDescripcion.value = '';
          filtro = '';
          pintarTabla();
          mostrarMsg('Registro "' + claveSel + '" modificado.', 'ok');
          toast('Registro modificado correctamente.');
        }).catch(function () {
          mostrarMsg('No se pudo modificar el registro.', 'er');
        });
        return;
      }

      if (!claveSel) {
        mostrarMsg('Selecciona un registro de la tabla para modificarlo.', 'er');
        return;
      }

      var registro = registroPorClave(claveSel);
      if (!registro) {
        mostrarMsg('El registro seleccionado ya no existe.', 'er');
        return;
      }

      modo = 'edicion';
      filtro = '';
      campoDescripcion.value = registro.descripcion;
      pintarTabla();
      mostrarMsg('Modifica la descripción y vuelve a pulsar "Modificar" para guardar.', 'av');
      campoDescripcion.focus();
      campoDescripcion.select();
    }

    function eliminar() {
      if (soloConsulta) {
        mostrarMsg('Tu perfil tiene acceso de solo consulta en este módulo: no puedes eliminar registros.', 'er');
        return;
      }

      if (!claveSel) {
        mostrarMsg('Selecciona un registro de la tabla para eliminarlo.', 'er');
        return;
      }

      var catalogo = catalogoSeleccionado();
      var nombreCatalogo = catalogo ? catalogo.nombre : 'catálogo';

      if (!window.confirm('¿Eliminar el registro "' + claveSel + '" del catálogo "' + nombreCatalogo + '"?')) return;

      borrarRegistroCatalogo(catalogoActual, claveSel);

      recargarCatalogos().then(function () {
        modo = 'consulta';
        claveSel = '';
        filtro = '';
        campoDescripcion.value = '';
        pintarTabla();
        mostrarMsg('Registro eliminado del catálogo.', 'ok');
        toast('Registro eliminado.');
      }).catch(function () {
        mostrarMsg('No se pudo eliminar el registro.', 'er');
      });
    }

    function consultar() {
      if (modo !== 'consulta') {
        mostrarMsg('Cancela o graba la operación en curso antes de consultar.', 'er');
        return;
      }

      if (!catalogoActual) {
        mostrarMsg('Selecciona un catálogo en el campo "Nombre de Catálogo".', 'er');
        return;
      }

      filtro = campoDescripcion.value.trim();
      claveSel = '';
      pintarTabla();
      mostrarMsg(filtro
        ? 'Consulta aplicada con el criterio "' + filtro + '".'
        : 'Consulta completa del catálogo "' + catalogoSeleccionado().nombre + '".', 'ok');
    }

    function cancelar() {
      modo = 'consulta';
      claveSel = '';
      filtro = '';
      campoDescripcion.value = '';
      pintarTabla();
      ocultarMsg();
      toast('Operación cancelada.');
    }

    selectCatalogo.addEventListener('change', function () {
      catalogoActual = selectCatalogo.value;
      modo = 'consulta';
      claveSel = '';
      filtro = '';
      campoDescripcion.value = '';
      pintarTabla();
      ocultarMsg();
    });

    if (botonNuevo) botonNuevo.addEventListener('click', function () {
      if (modo === 'nuevo') grabarNuevo();
      else iniciarNuevo();
    });
    if (botonModificar) botonModificar.addEventListener('click', modificar);
    if (botonEliminar) botonEliminar.addEventListener('click', eliminar);
    if (botonConsultar) botonConsultar.addEventListener('click', consultar);
    if (botonCancelar) botonCancelar.addEventListener('click', cancelar);
    if (botonSalir) botonSalir.addEventListener('click', function () {
      window.location.href = 'inicio.html';
    });

    campoDescripcion.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (modo === 'nuevo') grabarNuevo();
      else if (modo === 'edicion') modificar();
      else consultar();
    });

    Promise.all([cargarCatalogos(), cargarRoles()]).then(function () {
      pintarSelector();

      if (CATALOGOS.length) {
        selectCatalogo.value = CATALOGOS[0].id;
        catalogoActual = CATALOGOS[0].id;
      }

      soloConsulta = permisoDe(document.body.getAttribute('data-modulo'), claveRol(leerSesion().rol)) === 'consulta';
      bloquearEscritura(soloConsulta);
      pintarTabla();

      if (soloConsulta) {
        mostrarMsg('Perfil de solo consulta: puedes revisar los catálogos, pero no modificarlos.', 'av');
      }
    }).catch(function (error) {
      console.error(error);
      mostrarMsg('No se pudieron leer los catálogos del sistema. Verifica que el proyecto esté servido por un servidor local.', 'er');
    });
  }

  initCatalogoMantenimiento();

  /* ------------------------------------------------------------------
   * Módulo: aplicaciones del sistema (relación mAplicaciones)
   * ------------------------------------------------------------------ */
  var RUTA_APLICACIONES = 'aplicaciones.txt';
  var CLAVE_RESPALDO_APLICACIONES = 'nz_aplicaciones_respaldo';

  function parsearAplicaciones(texto) {
    return String(texto).split(/\r?\n/).reduce(function (lista, linea, indice) {
      var limpia = linea.trim();

      if (!limpia || limpia.charAt(0) === '#') return lista;

      var partes = limpia.split('|');
      if (partes.length < 2) {
        console.warn('aplicaciones.txt: la línea ' + (indice + 1) + ' no tiene el formato clave|descripcion.');
        return lista;
      }

      lista.push({
        clave: partes[0].trim(),
        descripcion: (partes[1] || '').trim()
      });

      return lista;
    }, []);
  }

  var promesaAplicaciones = null;
  var APLICACIONES_ARCHIVO = [];
  var APLICACIONES = [];

  function leerRespaldoAplicaciones() {
    return leerObjetoLocal(CLAVE_RESPALDO_APLICACIONES);
  }

  function escribirRespaldoAplicaciones(mapa) {
    localStorage.setItem(CLAVE_RESPALDO_APLICACIONES, JSON.stringify(mapa));
  }

  function aplicarRespaldoAplicaciones(aplicaciones) {
    var respaldo = leerRespaldoAplicaciones();
    var borrados = respaldo.__borrados || [];
    var nuevos = respaldo.__nuevos || {};
    var lista = [];

    aplicaciones.forEach(function (aplicacion) {
      if (borrados.indexOf(aplicacion.clave) !== -1) return;

      var cambio = respaldo[aplicacion.clave];
      lista.push({
        clave: aplicacion.clave,
        descripcion: cambio && typeof cambio.descripcion === 'string' ? cambio.descripcion : aplicacion.descripcion
      });
    });

    Object.keys(nuevos).forEach(function (clave) {
      if (borrados.indexOf(clave) !== -1) return;

      var repetida = lista.some(function (aplicacion) { return aplicacion.clave === clave; });
      if (!repetida) lista.push(nuevos[clave]);
    });

    return lista;
  }

  function guardarAplicacion(aplicacion) {
    var respaldo = leerRespaldoAplicaciones();
    var esNueva = !APLICACIONES_ARCHIVO.some(function (candidata) {
      return candidata.clave === aplicacion.clave;
    });

    if (esNueva) {
      respaldo.__nuevos = respaldo.__nuevos || {};
      respaldo.__nuevos[aplicacion.clave] = aplicacion;
      respaldo.__borrados = (respaldo.__borrados || []).filter(function (clave) {
        return clave !== aplicacion.clave;
      });
      delete respaldo[aplicacion.clave];
    } else {
      respaldo[aplicacion.clave] = { clave: aplicacion.clave, descripcion: aplicacion.descripcion };
      if (respaldo.__nuevos) delete respaldo.__nuevos[aplicacion.clave];
    }

    escribirRespaldoAplicaciones(respaldo);
    promesaAplicaciones = null;
  }

  function borrarAplicacion(clave) {
    var respaldo = leerRespaldoAplicaciones();

    respaldo.__borrados = respaldo.__borrados || [];
    if (respaldo.__borrados.indexOf(clave) === -1) respaldo.__borrados.push(clave);

    if (respaldo.__nuevos) delete respaldo.__nuevos[clave];
    delete respaldo[clave];

    escribirRespaldoAplicaciones(respaldo);
    promesaAplicaciones = null;
  }

  function cargarAplicaciones() {
    if (promesaAplicaciones) return promesaAplicaciones;

    promesaAplicaciones = leerTexto(RUTA_APLICACIONES).then(function (texto) {
      APLICACIONES_ARCHIVO = parsearAplicaciones(texto);
      APLICACIONES = aplicarRespaldoAplicaciones(APLICACIONES_ARCHIVO);
      return APLICACIONES;
    }).catch(function (error) {
      promesaAplicaciones = null;
      throw error;
    });

    return promesaAplicaciones;
  }

  function recargarAplicaciones() {
    promesaAplicaciones = null;
    return cargarAplicaciones();
  }

  function initAplicaciones() {
    var campoClave = document.getElementById('app-clave');
    var campoDescripcion = document.getElementById('app-descripcion');
    var cuerpo = document.getElementById('app-cuerpo');
    var pie = document.getElementById('app-pie');
    var cajaMsg = document.getElementById('app-msg');

    if (!campoClave || !campoDescripcion || !cuerpo) return;

    var botonNuevo = document.getElementById('app-nuevo');
    var botonBorrar = document.getElementById('app-borrar');
    var botonModificar = document.getElementById('app-modif');
    var botonConsultar = document.getElementById('app-consul');
    var botonCancelar = document.getElementById('app-cancel');
    var botonSalir = document.getElementById('app-salir');

    var modo = 'consulta';        /* consulta | nuevo | edicion */
    var claveConsultada = '';
    var soloConsulta = false;

    function mostrarMsg(texto, tipo) {
      if (!cajaMsg) {
        toast(texto, tipo === 'er' ? 'error' : 'info');
        return;
      }

      cajaMsg.className = 'msj ' + (tipo || '');
      cajaMsg.textContent = texto;
      cajaMsg.hidden = false;
    }

    function ocultarMsg() {
      if (!cajaMsg) return;
      cajaMsg.textContent = '';
      cajaMsg.hidden = true;
    }

    function bloquearCampos(bloquear) {
      campoClave.readOnly = bloquear;
      campoDescripcion.readOnly = bloquear;
    }

    function bloquearEscritura(bloquear) {
      [botonNuevo, botonBorrar, botonModificar].forEach(function (boton) {
        if (boton) boton.disabled = bloquear;
      });
    }

    function aplicacionPorClave(clave) {
      var encontrada = null;
      APLICACIONES.forEach(function (aplicacion) {
        if (aplicacion.clave === clave) encontrada = aplicacion;
      });
      return encontrada;
    }

    function pintarTabla() {
      cuerpo.innerHTML = '';

      APLICACIONES.forEach(function (aplicacion) {
        var fila = document.createElement('tr');
        fila.setAttribute('data-clave', aplicacion.clave);
        if (aplicacion.clave === claveConsultada) fila.className = 'sel';

        var celdaClave = document.createElement('td');
        celdaClave.className = 'mono';
        celdaClave.textContent = aplicacion.clave;

        var celdaDescripcion = document.createElement('td');
        celdaDescripcion.textContent = aplicacion.descripcion;

        fila.appendChild(celdaClave);
        fila.appendChild(celdaDescripcion);

        fila.addEventListener('click', function () {
          if (modo !== 'consulta') return;
          cargarAplicacion(aplicacion.clave);
        });

        cuerpo.appendChild(fila);
      });

      if (!APLICACIONES.length) {
        var filaVacia = document.createElement('tr');
        var celdaVacia = document.createElement('td');
        celdaVacia.colSpan = 2;
        celdaVacia.style.color = '#8A97A4';
        celdaVacia.textContent = 'Sin aplicaciones registradas.';
        filaVacia.appendChild(celdaVacia);
        cuerpo.appendChild(filaVacia);
      }

      if (pie) {
        pie.hidden = false;
        pie.textContent = APLICACIONES.length +
          (APLICACIONES.length === 1 ? ' aplicación registrada' : ' aplicaciones registradas');
      }
    }

    function limpiarTodo() {
      modo = 'consulta';
      claveConsultada = '';
      campoClave.value = '';
      campoDescripcion.value = '';
      bloquearCampos(true);
      pintarTabla();
    }

    function cargarAplicacion(clave) {
      var aplicacion = aplicacionPorClave(clave);

      if (!aplicacion) {
        limpiarTodo();
        return;
      }

      modo = 'consulta';
      claveConsultada = aplicacion.clave;
      campoClave.value = aplicacion.clave;
      campoDescripcion.value = aplicacion.descripcion;
      bloquearCampos(true);
      pintarTabla();
      ocultarMsg();
    }

    function iniciarNuevo() {
      if (soloConsulta) {
        mostrarMsg('Tu perfil tiene acceso de solo consulta en este módulo: no puedes dar de alta aplicaciones.', 'er');
        return;
      }

      modo = 'nuevo';
      claveConsultada = '';
      campoClave.value = '';
      campoDescripcion.value = '';
      bloquearCampos(false);
      pintarTabla();
      mostrarMsg('Captura la clave y la descripción de la aplicación y pulsa Modif para guardar.', 'av');
      campoClave.focus();
    }

    function habilitarEdicion() {
      if (!claveConsultada) {
        iniciarNuevo();
        return;
      }

      modo = 'edicion';
      bloquearCampos(false);
      campoClave.readOnly = true;
      pintarTabla();
      mostrarMsg('Modifica la descripción y pulsa Modif para guardar los cambios.', 'av');
      campoDescripcion.focus();
      campoDescripcion.select();
    }

    function validarAplicacion(datos, clavePropia) {
      if (!datos.clave) return 'Captura la clave de la aplicación.';
      if (!/^[a-z0-9][a-z0-9_-]{1,29}$/i.test(datos.clave)) {
        return 'La clave debe tener de 2 a 30 caracteres (letras, números, guion o guion bajo).';
      }
      if (!datos.descripcion) return 'Captura la descripción de la aplicación.';
      if (datos.descripcion.length < 3) return 'La descripción debe tener al menos 3 caracteres.';

      var repetida = APLICACIONES.some(function (aplicacion) {
        if (clavePropia && aplicacion.clave === clavePropia) return false;
        return normalizar(aplicacion.clave) === normalizar(datos.clave) ||
          normalizar(aplicacion.descripcion) === normalizar(datos.descripcion);
      });
      if (repetida) return 'Ya existe una aplicación con esa clave o descripción.';

      return '';
    }

    function guardar() {
      if (soloConsulta) {
        mostrarMsg('Tu perfil tiene acceso de solo consulta en este módulo: no puedes modificar aplicaciones.', 'er');
        return;
      }

      var datos = {
        clave: campoClave.value.trim(),
        descripcion: campoDescripcion.value.trim()
      };
      var esAlta = modo === 'nuevo';
      var error = validarAplicacion(datos, modo === 'edicion' ? claveConsultada : '');

      if (error) {
        mostrarMsg(error, 'er');
        toast(error, 'error');
        return;
      }

      guardarAplicacion(datos);

      recargarAplicaciones().then(function () {
        cargarAplicacion(datos.clave);
        mostrarMsg(esAlta ? 'Aplicación "' + datos.clave + '" registrada.' : 'Aplicación "' + datos.clave + '" actualizada.', 'ok');
        toast(esAlta ? 'Aplicación registrada correctamente.' : 'Aplicación actualizada correctamente.');
      }).catch(function () {
        mostrarMsg('No se pudo guardar la aplicación.', 'er');
      });
    }

    function borrar() {
      if (soloConsulta) {
        mostrarMsg('Tu perfil tiene acceso de solo consulta en este módulo: no puedes borrar aplicaciones.', 'er');
        return;
      }

      if (!claveConsultada) {
        mostrarMsg('Consulta o selecciona la aplicación que deseas borrar.', 'er');
        toast('Selecciona la aplicación que deseas borrar.', 'error');
        return;
      }

      if (!window.confirm('¿Eliminar la aplicación "' + claveConsultada + '"?')) return;

      borrarAplicacion(claveConsultada);

      recargarAplicaciones().then(function () {
        limpiarTodo();
        mostrarMsg('Aplicación eliminada.', 'ok');
        toast('Aplicación eliminada.');
      }).catch(function () {
        mostrarMsg('No se pudo eliminar la aplicación.', 'er');
      });
    }

    function consultar() {
      var clave = campoClave.value.trim();

      if (!clave) {
        mostrarMsg('Captura la clave de la aplicación que deseas consultar.', 'er');
        toast('Captura la clave de la aplicación.', 'error');
        campoClave.focus();
        return;
      }

      var aplicacion = aplicacionPorClave(clave);
      if (!aplicacion) {
        mostrarMsg('No existe ninguna aplicación con la clave "' + clave + '".', 'er');
        toast('No existe la aplicación indicada.', 'error');
        return;
      }

      cargarAplicacion(aplicacion.clave);
      mostrarMsg('Consulta de la aplicación "' + aplicacion.clave + '".', 'ok');
    }

    if (botonNuevo) botonNuevo.addEventListener('click', iniciarNuevo);
    if (botonBorrar) botonBorrar.addEventListener('click', borrar);
    if (botonModificar) botonModificar.addEventListener('click', function () {
      if (modo === 'consulta') habilitarEdicion();
      else guardar();
    });
    if (botonConsultar) botonConsultar.addEventListener('click', consultar);
    if (botonCancelar) botonCancelar.addEventListener('click', function () {
      if (modo !== 'consulta' && claveConsultada) cargarAplicacion(claveConsultada);
      else limpiarTodo();
      toast('Operación cancelada.');
    });
    if (botonSalir) botonSalir.addEventListener('click', function () {
      window.location.href = 'inicio.html';
    });

    [campoClave, campoDescripcion].forEach(function (campo) {
      campo.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (modo === 'consulta') consultar();
        else guardar();
      });
    });

    Promise.all([cargarAplicaciones(), cargarRoles()]).then(function () {
      soloConsulta = permisoDe(document.body.getAttribute('data-modulo'), claveRol(leerSesion().rol)) === 'consulta';
      bloquearEscritura(soloConsulta);
      pintarTabla();
    }).catch(function (error) {
      console.error(error);
      mostrarMsg('No se pudieron leer las aplicaciones del sistema. Verifica que el proyecto esté servido por un servidor local.', 'er');
    });
  }

  function initResumenAccesosGerente() {
    var selector = document.getElementById('gerente-filtro-rol');
    var contenedor = document.getElementById('gerente-modulos');
    if (!selector || !contenedor) return;

    function renderizar(roles) {
      selector.innerHTML = '<option value="">Selecciona un puesto</option>';
      roles.forEach(function (rol) {
        var opcion = document.createElement('option');
        opcion.value = rol.clave;
        opcion.textContent = rol.nombre;
        selector.appendChild(opcion);
      });
      selector.addEventListener('change', pintar);
      pintar();
    }

    function pintar() {
      contenedor.innerHTML = '';
      var rolClave = selector.value;
      var rol = rolDeClaveONombre(rolClave);
      if (!rol) {
        var ayuda = document.createElement('p');
        ayuda.className = 'tabla-pie';
        ayuda.textContent = 'Elige un puesto para consultar sus accesos.';
        contenedor.appendChild(ayuda);
        return;
      }
      MENU.filter(function (modulo) { return modulo.modulo && String(modulo.modulo) !== '0'; }).forEach(function (modulo) {
        var operaciones = operacionesDeRolEnModulo(rol.clave, modulo.modulo);
        var nombres = Object.keys(operaciones);
        if (!nombres.length) return;
        var tarjeta = document.createElement('article');
        tarjeta.className = 'gerente-modulo';
        var encabezado = document.createElement('div');
        encabezado.className = 'gerente-modulo-titulo';
        var titulo = document.createElement('strong');
        titulo.textContent = modulo.etiqueta;
        var nivel = document.createElement('span');
        nivel.className = 'tag ' + (nombres.some(function (n) { return n !== 'Consulta'; }) ? 'verde' : 'azul');
        nivel.textContent = nombres.some(function (n) { return n !== 'Consulta'; }) ? 'Completo' : 'Consulta';
        encabezado.appendChild(titulo);
        encabezado.appendChild(nivel);
        tarjeta.appendChild(encabezado);
        var detalle = document.createElement('p');
        detalle.textContent = 'Permisos: ' + nombres.join(', ');
        tarjeta.appendChild(detalle);
        var vistas = (modulo.submenu || []).filter(function (vista) { return !vista.soloRol || vista.soloRol === rol.clave; });
        if (vistas.length) {
          var lista = document.createElement('p');
          lista.className = 'gerente-vistas';
          lista.textContent = 'Vistas: ' + vistas.map(function (vista) { return vista.etiqueta; }).join(' · ');
          tarjeta.appendChild(lista);
        }
        contenedor.appendChild(tarjeta);
      });
      if (!contenedor.children.length) {
        var vacio = document.createElement('p');
        vacio.className = 'tabla-pie';
        vacio.textContent = 'Este puesto no tiene módulos asignados.';
        contenedor.appendChild(vacio);
      }
    }

    cargarRoles().then(function (datos) { renderizar(datos.roles); }).catch(function () {
      contenedor.textContent = 'No se pudieron cargar los roles y accesos. Abre el proyecto mediante un servidor HTTP.';
    });
  }
  initResumenAccesosGerente();

  function initConsultaTareasRecinto() {
    var cuerpo = document.getElementById('tarea-resultados');
    if (!cuerpo) return;
    var filtros = {
      recinto: document.getElementById('tarea-recinto'),
      encargado: document.getElementById('tarea-encargado'),
      desde: document.getElementById('tarea-desde'),
      hasta: document.getElementById('tarea-hasta'),
      estado: document.getElementById('tarea-estado'),
      puesto: document.getElementById('tarea-puesto')
    };
    var resumen = document.getElementById('tarea-resumen');
    var resumenPuestos = document.getElementById('tarea-resumen-puestos');
    var tareas = [];
    var personal = [];
    function isoFecha(texto) {
      var m = String(texto || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
      return m ? m[3] + '-' + m[2] + '-' + m[1] : '';
    }
    function leerPagina(ruta) {
      return fetch(ruta, {cache:'no-store'}).then(function (r) { if (!r.ok) throw new Error(ruta); return r.text(); }).then(function (html) { return new DOMParser().parseFromString(html, 'text/html'); });
    }
    function contieneRecinto(texto, numero) {
      var m = /Recinto\s+([^\n(]+)/i.exec(String(texto || ''));
      return !!(m && (m[1].match(/\d+/g) || []).indexOf(String(numero)) !== -1);
    }
    function esPendiente(tarea) {
      return tarea.estado === 'pendiente' || tarea.estado === 'en curso' || tarea.estado === 'vencida';
    }
    function pintarResumenPuestos() {
      if (!resumenPuestos) return;
      resumenPuestos.innerHTML = '';
      var puestos = [];
      personal.forEach(function (persona) {
        var nombrePuesto = persona.puesto || 'Puesto no registrado';
        if (!puestos.some(function (p) { return normalizar(p) === normalizar(nombrePuesto); })) puestos.push(nombrePuesto);
      });
      puestos.forEach(function (puesto) {
        var personasPuesto = personal.filter(function (p) { return normalizar(p.puesto || 'Puesto no registrado') === normalizar(puesto); });
        var tareasPuesto = tareas.filter(function (t) { return normalizar(t.puesto) === normalizar(puesto); });
        var tarjeta = document.createElement('article');
        tarjeta.className = 'gerente-puesto';
        var nombre = document.createElement('strong');
        nombre.textContent = puesto;
        var cantidad = document.createElement('span');
        cantidad.className = 'gerente-pendientes';
        cantidad.textContent = String(tareasPuesto.filter(esPendiente).length);
        var pie = document.createElement('small');
        pie.textContent = personasPuesto.map(nombreCompletoDe).filter(Boolean).join(', ') + ' · ' + tareasPuesto.length + ' tarea(s) de demostración';
        tarjeta.appendChild(nombre);
        tarjeta.appendChild(cantidad);
        tarjeta.appendChild(pie);
        resumenPuestos.appendChild(tarjeta);
      });
      if (!puestos.length) resumenPuestos.textContent = 'No se encontraron puestos en mDatosPersonales.txt.';
    }
    function render() {
      if (filtros.desde.value && filtros.hasta.value && filtros.desde.value > filtros.hasta.value) {
        resumen.textContent = 'La fecha inicial no puede ser posterior a la fecha final.';
        cuerpo.innerHTML = '<tr><td colspan="7">Corrige el periodo para consultar.</td></tr>';
        return;
      }
      var rs = tareas.filter(function (t) {
        if (filtros.recinto.value && normalizar(t.recinto).indexOf(normalizar(filtros.recinto.value)) === -1) return false;
        if (filtros.encargado.value && normalizar(t.encargado).indexOf(normalizar(filtros.encargado.value)) === -1) return false;
        if (filtros.desde.value && t.fecha < filtros.desde.value) return false;
        if (filtros.hasta.value && t.fecha > filtros.hasta.value) return false;
        if (filtros.estado.value && t.estado !== filtros.estado.value) return false;
        if (filtros.puesto.value && normalizar(t.puesto) !== normalizar(filtros.puesto.value)) return false;
        return true;
      });
      cuerpo.innerHTML = '';
      resumen.textContent = rs.length + ' tarea(s) de demostración · ' + rs.filter(esPendiente).length + ' pendiente(s), en curso o vencida(s).';
      if (!rs.length) { var tr=document.createElement('tr'), td=document.createElement('td'); td.colSpan=7; td.textContent='No hay resultados para esos filtros.'; tr.appendChild(td); cuerpo.appendChild(tr); return; }
      rs.forEach(function (t) {
        var tr=document.createElement('tr');
        [t.recinto,t.puesto + ' · ' + t.encargado,t.turno + ' / ' + t.vigencia,t.tarea,t.estado,t.cierre,t.observaciones].forEach(function (valor) { var td=document.createElement('td'); td.textContent=valor || 'No registrado'; tr.appendChild(td); });
        cuerpo.appendChild(tr);
      });
    }
    Promise.all([leerPagina('operacion-supervision.html'), leerPagina('personal-turnos.html'), cargarDatos()]).then(function (resultados) {
      var doc=resultados[0], asignaciones=resultados[1], datos=resultados[2];
      var encabezado=doc.querySelector('.topbar .tit p');
      var fecha=isoFecha(encabezado && encabezado.textContent);
      var filas=doc.querySelectorAll('.contenido table')[0].rows;
      var mapaAsignaciones={};
      var tablaAsig=asignaciones.querySelectorAll('.contenido table')[0];
      if (tablaAsig) Array.prototype.forEach.call(Array.from(tablaAsig.rows).slice(1),function(f){var c=f.cells;if(c.length>=6) mapaAsignaciones[c[0].textContent.trim()]=c[5].textContent.trim();});
      var tablaTurnos=asignaciones.querySelectorAll('.contenido table')[1];
      personal=datos.personas.filter(function (persona) { return !!persona.puesto; });
      personal.forEach(function (persona) {
        var opcion=document.createElement('option');
        opcion.value=persona.puesto;
        opcion.textContent=persona.puesto;
        if (filtros.puesto && !Array.prototype.some.call(filtros.puesto.options,function(o){return normalizar(o.value)===normalizar(opcion.value);})) filtros.puesto.appendChild(opcion);
      });
      var personalRecinto=personal.filter(function (persona) { return normalizar(persona.puesto).indexOf('encargado de recinto') !== -1; });
      if (!personalRecinto.length) throw new Error('No hay personal con puesto Encargado de Recinto en mDatosPersonales.txt.');
      var indicePersonal=0;
      Array.prototype.forEach.call(Array.from(filas).slice(1),function(f){
        var c=f.cells;if(c.length<9||!fecha)return;
        var recinto='Recinto '+c[2].textContent.trim(), actual=c[1].textContent.trim();
        var d=new Date(fecha+'T00:00:00'), hoy=new Date(); hoy.setHours(0,0,0,0);
        var estado=actual==='—'?(d<hoy?'vencida':'pendiente'):'completada';
        var persona=personalRecinto[indicePersonal % personalRecinto.length];
        indicePersonal += 1;
        var encargado=nombreCompletoDe(persona);
        var turno='No registrado';
        if(tablaTurnos){Array.prototype.forEach.call(Array.from(tablaTurnos.rows).slice(1),function(t){var texto=t.textContent; var n=recinto.match(/\d+/); if(n&&texto.indexOf(encargado)!==-1&&contieneRecinto(texto,n[0])) turno=t.cells[1].textContent.trim()+' · '+t.cells[2].textContent.trim();});}
        tareas.push({fecha:fecha,recinto:recinto,encargado:encargado,puesto:persona.puesto,turno:turno,vigencia:mapaAsignaciones[recinto]||'No registrado',tarea:c[3].textContent.trim()+' — '+c[0].textContent.trim(),estado:estado,cierre:actual==='—'?'No registrado':actual,observaciones:'Asignación ficticia, distribuida de forma equitativa para esta maqueta.'});
      });
      pintarResumenPuestos();
      render();
    }).catch(function (e) { console.warn(e); resumen.textContent='No se pudieron leer las fuentes locales de demostración. Abre el proyecto con un servidor HTTP.'; cuerpo.innerHTML='<tr><td colspan="7">No se pudieron cargar registros.</td></tr>'; if(resumenPuestos) resumenPuestos.textContent='No se pudo cargar el resumen por puesto.'; });
    Object.keys(filtros).forEach(function (k) { filtros[k].addEventListener('input',render); filtros[k].addEventListener('change',render); });
  }
  initConsultaTareasRecinto();

  function initCentroReportes() {
    var tipoEl = document.getElementById('rep-tipo');
    if (!tipoEl) return;
    var desdeEl = document.getElementById('rep-desde');
    var hastaEl = document.getElementById('rep-hasta');
    var alcanceEl = document.getElementById('rep-alcance');
    var recintoEl = document.getElementById('rep-recinto');
    var especieEl = document.getElementById('rep-especie');
    var ejemplarEl = document.getElementById('rep-ejemplar');
    var resultadosEl = document.getElementById('rep-resultados');
    var resumenEl = document.getElementById('rep-resumen');
    var generadoEl = document.getElementById('rep-generado');
    var pdfEl = document.getElementById('rep-pdf');
    var csvEl = document.getElementById('rep-csv');
    var rol = claveRol(leerSesion().rol);
    var puedeVerClinico = rol === 'gerente' || rol === 'veterinario';
    var datosActuales = [];
    var tipos = {
      consumo: [
        { fecha:'2026-10-26', tipo:'Consumo', recinto:'Recinto 3', especie:'Jaguar', ejemplar:'Kia', detalle:'Carne de res; programado 2.5 kg, suministrado 2.5 kg, cumplimiento 100 %', responsable:'No registrado', observaciones:'Historial nutricional de demostración' },
        { fecha:'2026-10-25', tipo:'Consumo', recinto:'Recinto 3', especie:'Jaguar', ejemplar:'Kia', detalle:'Carne de res; programado 2.5 kg, suministrado 1.8 kg, cumplimiento 72 %', responsable:'No registrado', observaciones:'Historial nutricional de demostración' },
        { fecha:'2026-10-24', tipo:'Consumo', recinto:'Recinto 3', especie:'Jaguar', ejemplar:'Kia', detalle:'Carne de res; programado 2.5 kg, suministrado 2.5 kg, cumplimiento 100 %', responsable:'No registrado', observaciones:'Historial nutricional de demostración' }
      ],
      inventario: [
        { fecha:'2026-10-26', tipo:'Merma', recinto:'No registrado', especie:'No registrado', ejemplar:'', detalle:'Carne de res; 2.5 kg; motivo: caducidad', responsable:'O. Bautista', observaciones:'No registrado' },
        { fecha:'2026-10-25', tipo:'Merma', recinto:'No registrado', especie:'No registrado', ejemplar:'', detalle:'Plátano; 4.0 kg; motivo: daño en el manejo', responsable:'J. Chan', observaciones:'No registrado' },
        { fecha:'2026-10-24', tipo:'Merma', recinto:'No registrado', especie:'No registrado', ejemplar:'', detalle:'Zacate (forraje); 6.0 kg; motivo: humedad en bodega', responsable:'L. Mendoza', observaciones:'No registrado' },
        { fecha:'2026-10-23', tipo:'Merma', recinto:'No registrado', especie:'No registrado', ejemplar:'', detalle:'Mezcla de semillas; 1.2 kg; motivo: vencimiento', responsable:'Servicios generales', observaciones:'No registrado' }
      ],
      alimentacion: [
        { fecha:'2026-10-27', tipo:'Alimentación', recinto:'Recinto 3', especie:'Jaguar', ejemplar:'Kia', detalle:'Programado 07:00; entregado 07:05; 2.5 kg de 2.5 kg; 100 %; a tiempo', responsable:'O. Bautista', observaciones:'Registro estático de demostración' },
        { fecha:'2026-10-27', tipo:'Alimentación', recinto:'Recinto 12', especie:'Tapir', ejemplar:'Chia', detalle:'Programado 07:00; entregado 07:32; 4.0 kg de 4.0 kg; tarde 32 min', responsable:'J. Chan', observaciones:'Registro estático de demostración' },
        { fecha:'2026-10-27', tipo:'Alimentación', recinto:'Recinto 5', especie:'Oso', ejemplar:'Bruno', detalle:'Programado 07:30; entregado 07:34; 1.2 kg de 1.2 kg; 100 %; a tiempo', responsable:'L. Mendoza', observaciones:'Registro estático de demostración' },
        { fecha:'2026-10-27', tipo:'Alimentación', recinto:'Recinto 7', especie:'Loro corona azul', ejemplar:'No registrado', detalle:'Programado 08:00; sin hora real ni cantidad confirmada; sin confirmar', responsable:'L. Mendoza', observaciones:'No registrado' },
        { fecha:'2026-10-27', tipo:'Alimentación', recinto:'Recinto 4', especie:'Tigre', ejemplar:'Nube', detalle:'Programado 10:00; entregado 09:58; 2.1 kg de 3.2 kg; cumplimiento 66 %; sobración 34 %', responsable:'O. Bautista', observaciones:'Registro estático de demostración' }
      ],
      salud: [
        { fecha:'2026-10-24', tipo:'Vacunación', recinto:'No registrado', especie:'No registrado', ejemplar:'No registrado', detalle:'Antirrábica — dosis anual, sin reacciones', responsable:'Dra. N. Peña', observaciones:'Próximo control: 24/10/2027' },
        { fecha:'2026-10-12', tipo:'Desparasitación', recinto:'No registrado', especie:'No registrado', ejemplar:'No registrado', detalle:'Ivermectina 1 mL IM — interno y externo', responsable:'Dra. N. Peña', observaciones:'Próximo control: 12/04/2027' },
        { fecha:'2026-10-03', tipo:'Consulta', recinto:'No registrado', especie:'No registrado', ejemplar:'No registrado', detalle:'Laceración en pata trasera derecha — curación diaria', responsable:'Dra. N. Peña', observaciones:'Próximo control: 10/10/2026' },
        { fecha:'2026-08-18', tipo:'Procedimiento quirúrgico', recinto:'No registrado', especie:'No registrado', ejemplar:'No registrado', detalle:'Esterilización — evolución sin complicaciones', responsable:'Dr. A. Ruiz', observaciones:'Próximo control: 18/08/2027' },
        { fecha:'2026-06-05', tipo:'Chequeo preventivo', recinto:'No registrado', especie:'No registrado', ejemplar:'No registrado', detalle:'Examen físico y laboratorio rutinario: normal', responsable:'Dra. N. Peña', observaciones:'Próximo control: 05/12/2026' },
        { fecha:'2026-10-25', tipo:'Cuarentena/observación', recinto:'No registrado', especie:'Loro corona azul', ejemplar:'Zola', detalle:'Pasteleosis sospechosa; aislada, apetito al 40 %, plumas erizadas', responsable:'No registrado', observaciones:'Alerta fuente: muestra el 28/10/2026 09:00; próximo control no registrado' },
        { fecha:'2026-10-26', tipo:'Cuarentena/observación', recinto:'No registrado', especie:'Tigre', ejemplar:'Nube', detalle:'Postquirúrgico; estable, herida limpia y sin inflamación', responsable:'No registrado', observaciones:'Próximo control no registrado' },
        { fecha:'2026-10-22', tipo:'Cuarentena/observación', recinto:'No registrado', especie:'Tapir centroamericano', ejemplar:'Chia', detalle:'Pérdida de peso del 6 %; consumo del 85 % de la ración, peso diario', responsable:'No registrado', observaciones:'Próximo control no registrado' }
      ],
      recintos: [
        { fecha:'2026-10-01', fin:'2026-12-31', tipo:'Asignación de recinto', recinto:'Recinto 3', especie:'Jaguar, puma', ejemplar:'', detalle:'Encargado principal O. Bautista; suplente L. Mendoza; vigencia 01/10–31/12/2026', responsable:'O. Bautista', observaciones:'Turno no registrado en esta fila' },
        { fecha:'2026-10-01', fin:'2026-12-31', tipo:'Asignación de recinto', recinto:'Recinto 4', especie:'Tigre', ejemplar:'', detalle:'Encargado principal O. Bautista; suplente L. Mendoza; vigencia 01/10–31/12/2026', responsable:'O. Bautista', observaciones:'Turno no registrado en esta fila' },
        { fecha:'2026-10-01', fin:'2026-12-31', tipo:'Asignación de recinto', recinto:'Recinto 7', especie:'Loro corona azul, guacamaya', ejemplar:'', detalle:'Encargado principal L. Mendoza; suplente J. Chan; vigencia 01/10–31/12/2026', responsable:'L. Mendoza', observaciones:'Turno no registrado en esta fila' },
        { fecha:'2026-10-01', fin:'2026-12-31', tipo:'Asignación de recinto', recinto:'Recinto 12', especie:'Tapir centroamericano, pecarí', ejemplar:'', detalle:'Encargado principal J. Chan; suplente R. Aguilar; vigencia 01/10–31/12/2026', responsable:'J. Chan', observaciones:'Turno no registrado en esta fila' }
      ]
    };
    tipos.oficiales = [].concat(tipos.consumo, tipos.inventario, tipos.alimentacion, puedeVerClinico ? tipos.salud : [], tipos.recintos);
    var opcionClinica = document.getElementById('rep-tipo').querySelector('option[value="salud"]');
    var opcionOficial = document.getElementById('rep-tipo').querySelector('option[value="oficiales"]');
    if (opcionClinica && !puedeVerClinico) { opcionClinica.disabled = true; opcionClinica.textContent += ' (solo Gerente / Médico Veterinario)'; }
    if (opcionOficial && !puedeVerClinico) { opcionOficial.textContent += ' (sin registros clínicos)'; }
    function fechaValida(valor) { return /^\d{4}-\d{2}-\d{2}$/.test(valor) && !isNaN(Date.parse(valor)); }
    function filtrar(registros, desde, hasta) {
      var recinto = normalizar(recintoEl.value);
      var especie = normalizar(especieEl.value);
      var ejemplar = normalizar(ejemplarEl.value);
      return registros.filter(function (r) {
        var fin = r.fin || r.fecha;
        if (fin < desde || r.fecha > hasta) return false;
        if (alcanceEl.value === 'recinto' && !recinto) return false;
        if (recinto && normalizar(r.recinto).indexOf(recinto) === -1) return false;
        if (especie && normalizar(r.especie).indexOf(especie) === -1) return false;
        if (ejemplar && normalizar(r.ejemplar).indexOf(ejemplar) === -1) return false;
        return true;
      });
    }
    function escaparCsv(valor) { return '"' + String(valor == null ? '' : valor).replace(/"/g, '""') + '"'; }
    function invalidarPreview(texto) {
      datosActuales = []; pdfEl.disabled = true; csvEl.disabled = true;
      resultadosEl.innerHTML = '';
      var fila = document.createElement('tr'); var celda = document.createElement('td'); celda.colSpan = 7; celda.textContent = 'Genera una vista previa válida para consultar resultados.'; fila.appendChild(celda); resultadosEl.appendChild(fila);
      resumenEl.textContent = 'Sin vista previa vigente.'; generadoEl.textContent = texto;
    }
    function pintar(registros, filtros) {
      datosActuales = registros;
      resultadosEl.innerHTML = '';
      pdfEl.disabled = !registros.length; csvEl.disabled = !registros.length;
      var ahora = new Date().toLocaleString('es-MX');
      var etiquetaTipo = tipoEl.options[tipoEl.selectedIndex].text;
      var criterios = 'Tipo: ' + etiquetaTipo + ' · Periodo: ' + filtros.desde + ' a ' + filtros.hasta + ' · Alcance: ' + (alcanceEl.value === 'parque' ? 'parque' : 'recinto ' + recintoEl.value) + (especieEl.value ? ' · Especie: ' + especieEl.value : '') + (ejemplarEl.value ? ' · Ejemplar: ' + ejemplarEl.value : '');
      resumenEl.textContent = criterios + ' · Generado: ' + ahora + ' · ' + registros.length + ' resultado(s).';
      generadoEl.textContent = 'Vista previa basada en datos estáticos de ejemplo; no constituye historial de reportes ni una consulta a una base de datos.';
      if (!registros.length) {
        var vacia = document.createElement('tr'); var celda = document.createElement('td'); celda.colSpan = 7; celda.textContent = 'No hay resultados para el periodo y filtros seleccionados.'; vacia.appendChild(celda); resultadosEl.appendChild(vacia); return;
      }
      registros.forEach(function (r) {
        var fila = document.createElement('tr');
        [r.fecha.split('-').reverse().join('/'), r.tipo, r.recinto || 'No registrado', [r.especie || 'No registrado', r.ejemplar ? '— ' + r.ejemplar : ''].filter(Boolean).join(' '), r.detalle || 'No registrado', r.responsable || 'No registrado', r.observaciones || 'No registrado'].forEach(function (v) { var td = document.createElement('td'); td.textContent = v; fila.appendChild(td); });
        resultadosEl.appendChild(fila);
      });
    }
    function aplicarRutaReporte() {
      var hash = (window.location.hash || '').replace(/^#/, '').toLowerCase();
      var mapeo = { consumo:'consumo', alimentacion:'alimentacion', inventario:'inventario', oficiales:'oficiales' };
      if (mapeo[hash] && tipoEl.value !== mapeo[hash]) {
        tipoEl.value = mapeo[hash];
        if (datosActuales.length || resumenEl.textContent !== 'Aún no se ha generado un reporte.') {
          invalidarPreview('El tipo cambió desde el menú. Genera una vista previa nueva antes de exportar.');
        }
      }
      if (hash) {
        var destino = document.getElementById(hash) || document.getElementById('centro');
        if (destino && typeof destino.scrollIntoView === 'function') destino.scrollIntoView({block:'start'});
      }
    }
    aplicarRutaReporte();
    window.addEventListener('hashchange', aplicarRutaReporte);
    var generar = document.getElementById('rep-generar');
    if (generar) generar.addEventListener('click', function () {
      var desde = desdeEl.value, hasta = hastaEl.value;
      if (!fechaValida(desde) || !fechaValida(hasta)) { invalidarPreview('Selecciona una fecha inicial y final válidas.'); desdeEl.focus(); return; }
      if (desde > hasta) { invalidarPreview('La fecha inicial no puede ser posterior a la fecha final.'); hastaEl.focus(); return; }
      if (alcanceEl.value === 'recinto' && !recintoEl.value.trim()) { invalidarPreview('Indica el recinto para aplicar ese alcance.'); recintoEl.focus(); return; }
      if (tipoEl.value === 'salud' && !puedeVerClinico) { invalidarPreview('La consulta clínica está limitada en esta maqueta a Gerente / Médico Veterinario; el control real requiere backend.'); return; }
      pintar(filtrar(tipos[tipoEl.value] || [], desde, hasta), {desde:desde, hasta:hasta});
    });
    [tipoEl, desdeEl, hastaEl, alcanceEl, recintoEl, especieEl, ejemplarEl].forEach(function (el) {
      el.addEventListener('input', function () { if (datosActuales.length || resumenEl.textContent !== 'Aún no se ha generado un reporte.') invalidarPreview('Los filtros cambiaron. Genera una vista previa nueva antes de exportar.'); });
      el.addEventListener('change', function () { if (datosActuales.length || resumenEl.textContent !== 'Aún no se ha generado un reporte.') invalidarPreview('Los filtros cambiaron. Genera una vista previa nueva antes de exportar.'); });
    });
    if (pdfEl) pdfEl.addEventListener('click', function () { if (datosActuales.length) window.print(); });
    if (csvEl) csvEl.addEventListener('click', function () {
      if (!datosActuales.length) return;
      var filas = [['Fecha','Tipo','Recinto','Especie / ejemplar','Detalle / resultado','Profesional / encargado','Próximo control / observaciones']];
      Array.prototype.forEach.call(resultadosEl.querySelectorAll('tr'), function (tr) { filas.push(Array.prototype.map.call(tr.cells, function (td) { return td.textContent; })); });
      var csv = '\ufeffsep=;\r\n' + filas.map(function (f) { return f.map(escaparCsv).join(';'); }).join('\r\n');
      var enlace = document.createElement('a'); enlace.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'})); enlace.download = 'nutrizoo-reporte-' + tipoEl.value + '-' + desdeEl.value + '-' + hastaEl.value + '.csv'; enlace.click(); setTimeout(function () { URL.revokeObjectURL(enlace.href); }, 1000);
    });
  }
  initCentroReportes();

  initAplicaciones();
})();
