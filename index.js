require("dotenv").config();
const TOKEN = process.env.DISCORD_TOKEN;

// index.js - Bot principal de asignación de materias

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
} = require("discord.js");
const fs = require("fs").promises;

// Leer el archivo JSON de materias
let materias = [];

async function cargarMaterias() {
  try {
    const data = await fs.readFile("./materias.json", "utf8");
    materias = JSON.parse(data);
    console.log(`✅ Se cargaron ${materias.length} materias`);
  } catch (error) {
    console.error("❌ Error al cargar materias:", error);
  }
}

// Crear el cliente de Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// Cuando el bot se conecta
client.once("ready", async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  console.log(`📚 Servidores: ${client.guilds.cache.size}`);

  await cargarMaterias();

  // Establecer estado del bot
  client.user.setActivity({
    name: `!ayuda ó !help | ${materias.length} materias`,
    type: 3, // WATCHING
  });
});

// Buscar materia por código
function buscarMateria(codigo) {
  return materias.find((m) => m.codigo.toLowerCase() === codigo.toLowerCase());
}

// Buscar materia por nombre (aproximado)
function buscarMateriaPorNombre(nombre) {
  return materias
    .filter((m) => m.materia.toLowerCase().includes(nombre.toLowerCase()))
    .slice(0, 5); // Límite de 5 resultados
}

// Crear o obtener un rol de materia
async function obtenerRolMateria(guild, nombreMateria) {
  // Limpiar nombre para evitar problemas con caracteres especiales
  const nombreLimpio = nombreMateria.substring(0, 100); // Discord limita a 100 chars

  // Buscar si ya existe el rol
  let rol = guild.roles.cache.find((r) => r.name === nombreLimpio);

  // Si no existe, crearlo
  if (!rol) {
    try {
      rol = await guild.roles.create({
        name: nombreLimpio,
        color: "Random", // Color aleatorio
        reason: `Rol creado automáticamente para materia ${nombreLimpio}`,
        permissions: [], // Sin permisos especiales
        mentionable: false,
      });
      console.log(`✅ Rol creado: ${rol.name} en ${guild.name}`);
    } catch (error) {
      console.error(`❌ Error al crear rol ${nombreLimpio}:`, error);
      return null;
    }
  }

  return rol;
}

// Comando: !materia <código>
client.on("messageCreate", async (message) => {
  // Evitar que el bot responda a sí mismo o a otros bots
  if (message.author.bot) return;

  // Verificar que sea un comando
  if (!message.content.startsWith("!materia")) return;

  // Verificar permisos del bot
  const botMember = await message.guild.members.fetch(client.user.id);
  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return message.reply(
      "❌ Necesito el permiso de **Gestionar Roles** para funcionar.",
    );
  }

  // Obtener código/nombre de la materia
  const args = message.content.split(" ");
  if (args.length < 2) {
    // Mostrar ayuda si no hay argumentos
    const embedAyuda = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("📚 Bot de Materias UNA")
      .setDescription("Comandos disponibles:")
      .addFields(
        {
          name: "Asignar materia",
          value: "`!materia <código>`\nEj: `!materia 311`",
        },
        {
          name: "Buscar materia",
          value: "`!buscar <nombre>`\nEj: `!buscar base de datos`",
        },
        {
          name: "Información",
          value: "`!info <código>`\nMuestra detalles de la materia",
        },
        {
          name: "Mis materias",
          value: "`!mismaterias`\nLista tus roles de materias",
        },
      )
      .setFooter({ text: `Total: ${materias.length} materias disponibles` });

    return message.reply({ embeds: [embedAyuda] });
  }

  const parametro = args[1];

  // Buscar por código primero
  let materia = buscarMateria(parametro);

  // Si no se encuentra por código, buscar por nombre aproximado
  if (!materia && parametro.length > 2) {
    const resultados = buscarMateriaPorNombre(parametro);
    if (resultados.length === 1) {
      materia = resultados[0];
    } else if (resultados.length > 1) {
      const embedBusqueda = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle(`🔍 ${resultados.length} resultados para "${parametro}"`)
        .setDescription("Usa el código exacto:")
        .addFields(
          resultados.slice(0, 5).map((m) => ({
            name: `${m.codigo} - ${m.materia.substring(0, 50)}${m.materia.length > 50 ? "..." : ""}`,
            value: `\`!materia ${m.codigo}\``,
            inline: false,
          })),
        )
        .setFooter({ text: "Selecciona uno usando el código exacto" });

      return message.reply({ embeds: [embedBusqueda] });
    }
  }

  // Si aún no se encuentra
  if (!materia) {
    return message.reply(
      `❌ No se encontró la materia con código o nombre "${parametro}"`,
    );
  }

  // Verificar si el usuario ya tiene el rol
  const miembro = await message.guild.members.fetch(message.author.id);
  const rolExistente = miembro.roles.cache.find(
    (r) => r.name === materia.materia,
  );

  if (rolExistente) {
    return message.reply(
      `✅ Ya tienes el rol **${materia.materia}** asignado.`,
    );
  }

  try {
    // Obtener o crear el rol
    const rol = await obtenerRolMateria(message.guild, materia.materia);

    if (!rol) {
      return message.reply(
        "❌ No se pudo crear/obtener el rol. Revisa mis permisos.",
      );
    }

    // Asignar el rol al usuario
    await miembro.roles.add(rol);

    // Crear embed de confirmación
    const embedExito = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("✅ Rol asignado correctamente")
      .addFields(
        { name: "Código", value: materia.codigo, inline: true },
        { name: "Materia", value: materia.materia, inline: true },
        { name: "Rol", value: rol.name, inline: true },
      );

    // Agregar información de asesores si existe
    if (materia.asesores && materia.asesores.length > 0) {
      const asesoresTexto = materia.asesores
        .map((a) => `• **${a.nombre}**\n  📧 ${a.correo}`)
        .join("\n\n");

      embedExito.addFields({
        name: `👨‍🏫 Asesor${materia.asesores.length > 1 ? "es" : ""}`,
        value: asesoresTexto,
      });
    }

    embedExito.setFooter({
      text: `Usuario: ${message.author.username} | Total roles: ${miembro.roles.cache.size - 1}`,
    });

    message.reply({ embeds: [embedExito] });
  } catch (error) {
    console.error("Error al asignar rol:", error);
    message.reply(
      "❌ Ocurrió un error al asignar el rol. Verifica que mi rol esté por encima del rol a asignar.",
    );
  }
});

// Comando: !remover <código>
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    if (message.content.startsWith('!remover') || message.content.startsWith('!quitar')) {
        // Verificar permisos del bot
        const botMember = await message.guild.members.fetch(client.user.id);
        if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return message.reply('❌ Necesito el permiso de **Gestionar Roles** para funcionar.');
        }
        
        // Obtener argumentos
        const args = message.content.split(' ');
        
        // Si no hay código, mostrar ayuda
        if (args.length < 2) {
            const embedAyuda = new EmbedBuilder()
                .setColor(0xFF5555)
                .setTitle('🗑️ Comando !remover')
                .setDescription('Elimina un rol de materia que tengas asignado.')
                .addFields(
                    { name: 'Uso', value: '`!remover <código>`', inline: true },
                    { name: 'Ejemplo', value: '`!remover 311`', inline: true },
                    { name: 'Alias', value: '`!quitar <código>`', inline: true }
                )
                .setFooter({ text: 'Usa !mismaterias para ver qué roles tienes asignados' });
            
            return message.reply({ embeds: [embedAyuda] });
        }
        
        const parametro = args[1];
        
        // Buscar la materia
        let materia = buscarMateria(parametro);
        
        // Si no se encuentra por código, buscar por nombre
        if (!materia && parametro.length > 2) {
            const resultados = buscarMateriaPorNombre(parametro);
            if (resultados.length === 1) {
                materia = resultados[0];
            } else if (resultados.length > 1) {
                // Mostrar opciones si hay varias coincidencias
                const embedOpciones = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle(`🔍 ${resultados.length} resultados para "${parametro}"`)
                    .setDescription('Usa el código exacto:')
                    .addFields(
                        resultados.slice(0, 5).map(m => ({
                            name: `${m.codigo} - ${m.materia.substring(0, 40)}${m.materia.length > 40 ? '...' : ''}`,
                            value: `\`!remover ${m.codigo}\``,
                            inline: false
                        }))
                    )
                    .setFooter({ text: 'Selecciona uno usando el código exacto' });
                
                return message.reply({ embeds: [embedOpciones] });
            }
        }
        
        // Si no se encuentra la materia
        if (!materia) {
            return message.reply(`❌ No se encontró la materia con código o nombre "${parametro}"`);
        }
        
        try {
            // Obtener el miembro y verificar si tiene el rol
            const miembro = await message.guild.members.fetch(message.author.id);
            const rolExistente = miembro.roles.cache.find(r => r.name === materia.materia);
            
            if (!rolExistente) {
                return message.reply(`❌ No tienes el rol **${materia.materia}** asignado.`);
            }
            
            // Quitar el rol
            await miembro.roles.remove(rolExistente);
            
            // Crear embed de confirmación
            const embedExito = new EmbedBuilder()
                .setColor(0x00AA00)
                .setTitle('✅ Rol eliminado correctamente')
                .addFields(
                    { name: 'Código', value: materia.codigo, inline: true },
                    { name: 'Materia', value: materia.materia, inline: true },
                    { name: 'Acción', value: 'Rol removido', inline: true }
                )
                .setFooter({ 
                    text: `Usuario: ${message.author.username} | Roles restantes: ${miembro.roles.cache.size - 1}` 
                })
                .setTimestamp();
            
            message.reply({ embeds: [embedExito] });
            
        } catch (error) {
            console.error('Error al remover rol:', error);
            message.reply('❌ Ocurrió un error al remover el rol. Verifica mis permisos.');
        }
    }
});

// Comando adicional: !buscar <nombre>
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith("!buscar")) {
    const args = message.content.split(" ");
    if (args.length < 2) {
      return message.reply("❌ Uso: `!buscar <nombre de la materia>`");
    }

    const busqueda = args.slice(1).join(" ");
    const resultados = buscarMateriaPorNombre(busqueda);

    if (resultados.length === 0) {
      return message.reply(`❌ No se encontraron materias con "${busqueda}"`);
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`🔍 Resultados para "${busqueda}"`)
      .setDescription(`Se encontraron ${resultados.length} materias`);

    resultados.forEach((materia, index) => {
      embed.addFields({
        name: `${index + 1}. ${materia.codigo} - ${materia.materia.substring(0, 60)}${materia.materia.length > 60 ? "..." : ""}`,
        value: `Asignar: \`!materia ${materia.codigo}\``,
        inline: false,
      });
    });

    message.reply({ embeds: [embed] });
  }
});

// Comando: !info <código>
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith("!info")) {
    const args = message.content.split(" ");
    if (args.length < 2) {
      return message.reply("❌ Uso: `!info <código de materia>`");
    }

    const materia = buscarMateria(args[1]);
    if (!materia) {
      return message.reply(
        `❌ No se encontró la materia con código "${args[1]}"`,
      );
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`📋 ${materia.materia}`)
      .addFields(
        { name: "Código", value: materia.codigo, inline: true },
        { name: "Estado", value: "Disponible", inline: true },
      );

    if (materia.asesores && materia.asesores.length > 0) {
      const asesoresTexto = materia.asesores
        .map((a) => `**${a.nombre}**\n📧 ${a.correo}`)
        .join("\n\n");

      embed.addFields({
        name: `👨‍🏫 Asesor${materia.asesores.length > 1 ? "es" : ""}`,
        value: asesoresTexto,
      });
    } else {
      embed.addFields({
        name: "Asesor",
        value: "No asignado aún",
      });
    }

    embed.setFooter({
      text: `Comando para asignar: !materia ${materia.codigo}`,
    });

    message.reply({ embeds: [embed] });
  }
});

// Comando: !mismaterias
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith("!mismaterias")) {
    try {
      const miembro = await message.guild.members.fetch(message.author.id);
      const rolesMaterias = miembro.roles.cache
        .filter((rol) => materias.some((m) => m.materia === rol.name))
        .map((rol) => rol.name);

      if (rolesMaterias.length === 0) {
        return message.reply(
          "📭 No tienes roles de materias asignados. Usa `!materia <código>` para agregar uno.",
        );
      }

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`📚 Tus materias (${rolesMaterias.length})`)
        .setDescription(
          rolesMaterias.map((m, i) => `${i + 1}. ${m}`).join("\n"),
        )
        .setFooter({ text: `Usuario: ${message.author.username}` });

      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      message.reply("❌ Ocurrió un error al obtener tus materias.");
    }
  }
});

// Comando: !ayuda o !help
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    if (message.content === '!ayuda' || message.content === '!help' || message.content === '!comandos') {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🤖 Comandos del UNA Bot')
            .setDescription('Aquí están todos los comandos disponibles:')
            .addFields(
                {
                    name: '🎓 `!materia <código>`',
                    value: '```Asigna el rol de una materia\nEjemplo: !materia 311```',
                    inline: true
                },
                {
                    name: '🔍 `!buscar <nombre>`',
                    value: '```Busca materias por nombre\nEjemplo: !buscar matematica```',
                    inline: true
                },
                {
                    name: '📋 `!info <código>`',
                    value: '```Muestra información completa\nEjemplo: !info 311```',
                    inline: true
                },
                {
                    name: '📚 `!mismaterias`',
                    value: '```Lista tus materias asignadas\nEjemplo: !mismaterias```',
                    inline: true
                },
                {
                    name: ':wastebasket: `!remover <código>`',
                    value: '```Elimina un rol de materia asignado\nEjemplo: !remover 311```',
                    inline: true
                },
                // {
                //     name: '⚙️ Permisos necesarios',
                //     value: '```El bot necesita:\n• Gestionar Roles\n• Leer mensajes\n• Enviar mensajes```',
                //     inline: false
                // }
            )
            .setFooter({ 
                text: `Bot oficial de la comunidad UNA | Total materias registradas: ${materias.length} ` 
            })
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    }
});

// Manejo de errores
client.on("error", console.error);
process.on("unhandledRejection", console.error);

// Iniciar el bot
client.login(TOKEN);
