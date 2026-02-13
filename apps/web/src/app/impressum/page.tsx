import Link from "next/link";

export const metadata = {
  title: "Impressum | BlitzClaw",
};

export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="text-blue-400 hover:underline mb-8 inline-block">
          ← Back to BlitzClaw
        </Link>
        
        <h1 className="text-3xl font-bold mb-8">Impressum</h1>
        
        <div className="prose prose-invert prose-gray max-w-none space-y-6 text-gray-300">
          
          <h2 className="text-xl font-semibold text-white mt-8">Angaben gemäß § 5 DDG</h2>
          
          <p>
            <strong>2M Ventures UG (haftungsbeschränkt)</strong><br />
            Hohenstaufenstr. 22<br />
            10779 Berlin<br />
            Deutschland
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">Vertreten durch</h2>
          <p>
            Geschäftsführer: Philipp Müller
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">Kontakt</h2>
          <p>
            E-Mail: support@blitzclaw.com
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">Registereintrag</h2>
          <p>
            Eintragung im Handelsregister.<br />
            Registergericht: Amtsgericht Charlottenburg (Berlin)<br />
            Registernummer: HRB 275962 B
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">Umsatzsteuer-ID</h2>
          <p>
            Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz:<br />
            USt.-ID: In Beantragung
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
          <p>
            Philipp Müller<br />
            Hohenstaufenstr. 22<br />
            10779 Berlin
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">Verbraucherstreitbeilegung</h2>
          <p>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer 
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">Haftung für Inhalte</h2>
          <p>
            Als Diensteanbieter sind wir gemäß § 7 Abs.1 DDG für eigene Inhalte auf diesen Seiten 
            nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als 
            Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde 
            Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige 
            Tätigkeit hinweisen.
          </p>
          <p>
            Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den 
            allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch 
            erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei 
            Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend 
            entfernen.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">Haftung für Links</h2>
          <p>
            Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen 
            Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. 
            Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der 
            Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf 
            mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung 
            nicht erkennbar. Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch 
            ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von 
            Rechtsverletzungen werden wir derartige Links umgehend entfernen.
          </p>
        </div>
      </div>
    </div>
  );
}
