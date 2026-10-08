<script>
  import questions from 'virtual:questions';
  const probe = '<' + '/script> <' + '!-- ' + String.fromCharCode(0x2028);
</script>

<p id="count">{questions.length}</p>
<p id="probe">{probe.length}</p>
<p id="first">{questions[0].id}</p>
